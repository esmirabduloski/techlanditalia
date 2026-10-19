/**
 * Centro di controllo Email per gli admin (/admin/email).
 *
 * Solo admin con la verifica in due passaggi (sessione aal2). Azioni:
 *   - catalog:  tutti i tipi di email con un esempio (dati finti) e quante ne
 *               sono partite / fallite negli ultimi 30 giorni;
 *   - upcoming: le email previste nei prossimi 30/60/90 giorni, simulando le
 *               regole dei job pianificati (_shared/emailforecast.ts);
 *   - test:     manda l'esempio di un tipo all'email dell'admin, con [PROVA]
 *               nell'oggetto (finisce anche nel registro).
 * Lo storico delle email inviate la pagina lo legge direttamente da email_log.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { sendEmail } from "../_shared/email.ts";
import { isEmailKind, type EmailKind } from "../_shared/emailkinds.ts";
import { emailCatalog, emailSample } from "../_shared/emailcatalog.ts";
import {
  addDays,
  forecastClosures,
  forecastDataRetention,
  forecastMonthlyReport,
  forecastPauses,
  forecastPayments,
  sortUpcoming,
  type ForecastClosure,
  type ForecastPause,
  type ForecastPayment,
} from "../_shared/emailforecast.ts";
import { NOTICE_DAYS_BEFORE } from "../_shared/closurenotice.ts";
import { parseDunning } from "../_shared/paymentreminders.ts";
import { romeToday, silencedProfileIds } from "../_shared/subscriptionpause.ts";
import { DEFAULT_RETENTION_NOTIFY_EMAILS, emailList } from "../_shared/emailtemplates.ts";

const FN = "admin-email-center";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("catalog") }),
  z.object({ action: z.literal("upcoming"), days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30) }),
  z.object({ action: z.literal("test"), kind: z.string().refine(isEmailKind, "tipo di email sconosciuto") }),
]);

type Profile = { id: string; full_name: string | null; email: string | null; parent_id?: string | null };

async function catalog(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const counts = new Map<string, { sent: number; failed: number }>();
  const { data, error } = await supabase
    .from("email_log")
    .select("kind, status")
    .gte("created_at", since)
    .neq("source", FN)
    .limit(20000);
  // Registro non ancora creato (migrazione 0057 da applicare): catalogo senza conteggi
  if (error) console.warn(`[${FN}] email_log non leggibile: ${error.message}`);
  for (const row of data ?? []) {
    const c = counts.get(row.kind as string) ?? { sent: 0, failed: 0 };
    if (row.status === "sent") c.sent++;
    else c.failed++;
    counts.set(row.kind as string, c);
  }
  return {
    logReady: !error,
    entries: emailCatalog(SITE_URL).map(({ storeBody, ...e }) => ({
      ...e,
      sensitive: !storeBody,
      sent30d: counts.get(e.kind)?.sent ?? 0,
      failed30d: counts.get(e.kind)?.failed ?? 0,
    })),
  };
}

/**
 * Chiusure che il job school-closure-notice annuncerà nella finestra, con le
 * famiglie da avvisare. Best effort: se la tabella non c'è ancora (migrazione
 * 0060 non applicata) la scheda mostra il resto.
 */
async function loadClosures(supabase: SupabaseClient, now: Date, days: number, silenced: Set<string>): Promise<ForecastClosure[]> {
  const today = romeToday(now);
  const { data, error } = await supabase
    .from("school_closures")
    .select("id, title, start_date, end_date, note, notified_at")
    .is("notified_at", null)
    .gte("start_date", today)
    .lte("start_date", addDays(today, days + NOTICE_DAYS_BEFORE));
  if (error) {
    console.warn(`[${FN}] school_closures: ${error.message}`);
    return [];
  }
  const out: ForecastClosure[] = [];
  for (const c of (data ?? []) as (ForecastClosure & { id: string })[]) {
    const { data: audience, error: audienceErr } = await supabase.rpc("school_closure_audience", { p_closure_id: c.id });
    if (audienceErr) {
      console.warn(`[${FN}] school_closure_audience: ${audienceErr.message}`);
      continue;
    }
    const rows = (audience ?? []) as { recipient_id: string; student_ids: string[] }[];
    const ids = [...new Set(rows.flatMap((r) => [r.recipient_id, ...r.student_ids]))];
    const { data: profileRows } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    const profiles = new Map(((profileRows ?? []) as Profile[]).map((p) => [p.id, p]));
    out.push({
      title: c.title,
      start_date: c.start_date,
      end_date: c.end_date,
      note: c.note,
      notified_at: c.notified_at,
      recipients: rows.flatMap((r) => {
        const students = r.student_ids.filter((id) => !silenced.has(id));
        if (students.length === 0) return [];
        const recipient = profiles.get(r.recipient_id);
        return [{
          recipientId: r.recipient_id,
          recipientName: recipient?.full_name ?? null,
          recipientEmail: recipient?.email ?? null,
          studentNames: students.map((id) => profiles.get(id)?.full_name).filter((n): n is string => !!n),
        }];
      }),
    });
  }
  return out;
}

async function upcoming(supabase: SupabaseClient, days: number) {
  const now = new Date();
  const [paymentsRes, rulesRes, devicesRes, pausesRes, adminsRes, reportsRes, silenced] = await Promise.all([
    supabase
      .from("crm_payments")
      .select("id, amount_cents, description, due_date, reminder_date, installment_number, installment_total, remind_client, client_reminder_sent_at, overdue_reminder_count, last_overdue_reminder_at, crm_leads(full_name, email, linked_profile_id)")
      .eq("status", "scheduled")
      .eq("remind_client", true),
    supabase.from("site_settings").select("value").eq("key", "crm_payment_dunning").maybeSingle(),
    supabase.from("push_devices").select("user_id"),
    supabase
      .from("subscription_pauses")
      .select("ends_on, reminder_14_sent_at, reminder_7_sent_at, student_id, student:profiles!subscription_pauses_student_id_fkey(full_name, email, parent_id)")
      .is("ended_at", null)
      .not("ends_on", "is", null),
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
    supabase.from("monthly_reports").select("month, sent_at").not("sent_at", "is", null),
    silencedProfileIds(supabase, now),
  ]);
  for (const [name, res] of Object.entries({ paymentsRes, devicesRes, pausesRes, adminsRes })) {
    if (res.error) throw new Error(`${name}: ${res.error.message}`);
  }

  const pushUsers = new Set((devicesRes.data ?? []).map((d) => d.user_id as string));

  // Famiglie delle pause: il genitore se c'è, altrimenti lo studente
  type PauseRow = {
    ends_on: string | null;
    reminder_14_sent_at: string | null;
    reminder_7_sent_at: string | null;
    student_id: string;
    student: { full_name: string | null; email: string | null; parent_id: string | null } | null;
  };
  const pauseRows = (pausesRes.data ?? []) as unknown as PauseRow[];
  const adminIds = [...new Set((adminsRes.data ?? []).map((r) => r.user_id as string))];
  const profileIds = [...new Set([...pauseRows.map((p) => p.student?.parent_id).filter((x): x is string => !!x), ...adminIds])];
  const { data: profileRows, error: profilesError } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(`profiles: ${profilesError.message}`);
  const profiles = new Map(((profileRows ?? []) as Profile[]).map((p) => [p.id, p]));

  const pauses: ForecastPause[] = pauseRows.map((p) => {
    const parent = p.student?.parent_id ? profiles.get(p.student.parent_id) : undefined;
    return {
      ends_on: p.ends_on,
      reminder_14_sent_at: p.reminder_14_sent_at,
      reminder_7_sent_at: p.reminder_7_sent_at,
      studentName: p.student?.full_name || "Studente",
      recipientId: parent?.id ?? p.student_id,
      recipientName: parent?.full_name ?? p.student?.full_name ?? null,
      recipientEmail: parent?.email ?? p.student?.email ?? null,
    };
  });

  const admins = adminIds
    .map((id) => profiles.get(id))
    .filter((p): p is Profile => !!p?.email)
    .map((p) => ({ name: p.full_name, email: p.email!.trim().toLowerCase() }));
  const uniqueAdmins = [...new Map(admins.map((a) => [a.email, a])).values()];

  const items = sortUpcoming([
    ...forecastPayments({
      payments: (paymentsRes.data ?? []) as unknown as ForecastPayment[],
      rules: parseDunning(rulesRes.data?.value),
      now,
      days,
      pushUsers,
      silenced,
    }),
    ...forecastPauses({ pauses, now, days, pushUsers }),
    ...forecastClosures({ closures: await loadClosures(supabase, now, days, silenced), now, days, pushUsers }),
    ...forecastMonthlyReport({
      now,
      days,
      admins: uniqueAdmins,
      sentMonths: new Set((reportsRes.data ?? []).map((r) => r.month as string)),
    }),
    ...forecastDataRetention({
      now,
      days,
      recipients: emailList(Deno.env.get("RETENTION_NOTIFY_EMAILS") || DEFAULT_RETENTION_NOTIFY_EMAILS),
    }),
  ]);
  return { items, days };
}

async function sendTest(kind: EmailKind, user: { id: string; email?: string }) {
  if (kind === "trustpilot_invite") {
    return { status: 400, body: { ok: false, error: "Questa email la legge solo Trustpilot: non c'è niente da vedere in una prova" } };
  }
  const to = user.email?.trim();
  if (!to) return { status: 400, body: { ok: false, error: "Il tuo account non ha un indirizzo email" } };
  const sample = emailSample(kind, SITE_URL);
  const result = await sendEmail({
    kind,
    source: FN,
    to,
    subject: `[PROVA] ${sample.subject}`,
    html: sample.html,
    text: sample.text,
    recipientId: user.id,
  });
  return result.ok
    ? { status: 200, body: { ok: true, to } }
    : { status: 502, body: { ok: false, to, error: result.error } };
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const limited = await rateLimit(req, { endpoint: FN, maxRequests: 300, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const { data: adminRole } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin" }, 403);
    // Gli admin operano solo con la verifica in due passaggi completata (sessione aal2)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Richiesta non valida" }, 400);
    const body = parsed.data;

    if (body.action === "catalog") return json(await catalog(supabase));
    if (body.action === "upcoming") return json(await upcoming(supabase, body.days));

    const testLimited = await rateLimit(req, {
      endpoint: `${FN}-test`,
      maxRequests: 20,
      windowSeconds: 3600,
      identifier: user.id,
      message: "Troppe email di prova: riprova tra un'ora",
      corsHeaders,
    });
    if (testLimited) return testLimited;
    const test = await sendTest(body.kind as EmailKind, user);
    return json(test.body, test.status);
  } catch (error) {
    await captureServerError(error, { fn: FN });
    return json({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});


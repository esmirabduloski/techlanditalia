/**
 * Avviso delle chiusure e festività (drizzle/migrations/0060_school_closures.sql).
 *
 * Ogni mattina (job pg_cron school-closure-notice-daily, header x-cron-token)
 * cerca le chiusure che iniziano entro 3 giorni e non ancora annunciate e
 * avvisa con push ed email le famiglie che in quei giorni avrebbero lezione
 * (public.school_closure_audience). Salta gli studenti in pausa.
 * Se l'admin sposta le date di una chiusura annunciata, il trigger azzera
 * notified_at e l'avviso riparte con le date nuove.
 *
 * Chiamata anche da un admin con 2FA, che riceve il riepilogo in risposta.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";
import { REPLY_TO, sendEmail } from "../_shared/email.ts";
import {
  CLOSURES_PATH,
  NOTICE_DAYS_BEFORE,
  closureNoticeEmail,
  closureNoticeMessage,
  noticeDue,
  type ClosureForNotice,
} from "../_shared/closurenotice.ts";
import { pausedStudentIds, romeToday } from "../_shared/subscriptionpause.ts";
import { addDays } from "../_shared/emailforecast.ts";

const FN = "school-closure-notice";
// Stesso crontab del job pg_cron school-closure-notice-daily
const MONITOR = { slug: FN, schedule: "0 7 * * *", marginMinutes: 30, maxRuntimeMinutes: 10 };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

type ClosureRow = ClosureForNotice & { id: string; notified_at: string | null };
type AudienceRow = { recipient_id: string; student_ids: string[] };
type Profile = { id: string; full_name: string; email: string | null };

type Summary = {
  closures: string[];
  families: number;
  push_sent: number;
  emails_sent: number;
  skipped: { recipient: string; reason: string }[];
};

async function sendPush(supabase: SupabaseClient, userId: string, title: string, body: string): Promise<number> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !CONNECTION_KEY) return 0;

  const { data: devices } = await supabase.from("push_devices").select("id, token").eq("user_id", userId);
  let ok = 0;
  for (const device of devices ?? []) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": CONNECTION_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token: device.token, notification: { title, body }, data: { path: CLOSURES_PATH } },
      }),
    });
    if (res.ok) {
      ok++;
    } else {
      const text = await res.text();
      console.error(`[${FN}] FCM ${res.status}: ${text}`);
      if (res.status === 404 || res.status === 400) {
        await supabase.from("push_devices").delete().eq("id", device.id as string);
      }
    }
  }
  return ok;
}

async function run(supabase: SupabaseClient): Promise<Summary> {
  const summary: Summary = { closures: [], families: 0, push_sent: 0, emails_sent: 0, skipped: [] };
  const today = romeToday();

  const { data, error } = await supabase
    .from("school_closures")
    .select("id, title, start_date, end_date, note, notified_at")
    .is("notified_at", null)
    .gte("start_date", today)
    .lte("start_date", addDays(today, NOTICE_DAYS_BEFORE))
    .order("start_date");
  if (error) throw new Error(`school_closures: ${error.message}`);
  const due = ((data ?? []) as ClosureRow[]).filter((c) => noticeDue({ today, startDate: c.start_date, notifiedAt: c.notified_at }));
  if (due.length === 0) return summary;

  const paused = await pausedStudentIds(supabase);

  for (const closure of due) {
    // Segna prima di inviare: se due esecuzioni si sovrappongono parte un solo avviso
    const { data: claimed } = await supabase
      .from("school_closures")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", closure.id).is("notified_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    summary.closures.push(closure.title);

    const { data: audienceData, error: audienceErr } = await supabase.rpc("school_closure_audience", { p_closure_id: closure.id });
    if (audienceErr) {
      // Si riprova al giro successivo
      await supabase.from("school_closures").update({ notified_at: null }).eq("id", closure.id);
      throw new Error(`school_closure_audience: ${audienceErr.message}`);
    }
    const audience = (audienceData ?? []) as AudienceRow[];
    const ids = [...new Set(audience.flatMap((a) => [a.recipient_id, ...a.student_ids]))];
    const { data: profileRows } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    const profiles = new Map(((profileRows ?? []) as Profile[]).map((p) => [p.id, p]));

    for (const a of audience) {
      const recipient = profiles.get(a.recipient_id);
      const students = a.student_ids.filter((id) => !paused.has(id));
      if (students.length === 0) continue;
      // Lo studente senza genitore riceve l'avviso per sé: niente nomi nel testo
      const isParent = !a.student_ids.includes(a.recipient_id);
      const names = isParent ? students.map((id) => profiles.get(id)?.full_name).filter((n): n is string => !!n) : [];
      const msg = closureNoticeMessage({ closure, studentNames: names, today });
      const email = recipient?.email?.trim();

      const pushed = await sendPush(supabase, a.recipient_id, msg.title, msg.body);
      const mailed = email
        ? (await sendEmail({
          kind: "closure_notice",
          source: FN,
          to: email,
          replyTo: REPLY_TO,
          recipientId: a.recipient_id,
          ...closureNoticeEmail(msg, { parentName: isParent ? recipient?.full_name ?? null : null, siteUrl: SITE_URL }),
        })).ok
        : false;
      summary.families++;
      summary.push_sent += pushed;
      if (mailed) summary.emails_sent++;
      if (!pushed && !mailed) {
        summary.skipped.push({ recipient: recipient?.full_name ?? a.recipient_id, reason: "nessuna push attiva e nessuna email" });
      }
    }
  }
  return summary;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let isCron = false;
  const cronToken = req.headers.get("x-cron-token") ?? "";
  if (cronToken) {
    const { data: ok } = await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken });
    isCron = ok === true;
  }
  if (!isCron) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = auth.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Non autorizzato" }, 401);
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Non autorizzato" }, 403);
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);
  }

  return withCronMonitor(isCron ? MONITOR : null, FN, async () => {
    try {
      const summary = await run(supabase);
      return json({ ok: true, ...summary });
    } catch (err) {
      await captureServerError(err, { fn: FN, tags: { area: "cron" } });
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
});

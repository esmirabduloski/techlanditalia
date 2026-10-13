/**
 * Pause dell'abbonamento (drizzle/migrations/0030_subscription_pauses.sql).
 *
 * Ogni mattina (job pg_cron subscription-pause-check-daily, header x-cron-token):
 *   1. chiude le pause arrivate alla data di ripresa (end_reason 'auto') e lo
 *      annota nella timeline del lead della famiglia;
 *   2. 14 e 7 giorni prima della ripresa avvisa la famiglia con push ed email.
 *      Sono le uniche notifiche che una famiglia in pausa riceve.
 *
 * Chiamata anche da un admin con 2FA, che riceve il riepilogo in risposta.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";
import { pauseEndingMessage, reminderDue, romeToday } from "../_shared/subscriptionpause.ts";

const FN = "subscription-pause-check";
// Stesso crontab del job pg_cron subscription-pause-check-daily
const MONITOR = { slug: FN, schedule: "0 7 * * *", marginMinutes: 30, maxRuntimeMinutes: 10 };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

type PauseRow = {
  id: string;
  student_id: string;
  ends_on: string | null;
  reminder_14_sent_at: string | null;
  reminder_7_sent_at: string | null;
  student: { full_name: string; email: string | null; parent_id: string | null } | null;
};
type Profile = { id: string; full_name: string; email: string | null };

type Summary = {
  resumed: number;
  reminders: number;
  push_sent: number;
  emails_sent: number;
  skipped: { student: string; reason: string }[];
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
        message: { token: device.token, notification: { title, body }, data: { path: "/area-riservata" } },
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

async function sendEmail(to: string, title: string, body: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn(`[${FN}] RESEND_API_KEY mancante, email non inviata`);
    return false;
  }
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(title)}</h1></td></tr>
  <tr><td style="padding:28px 24px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${escapeHtml(body)}</p>
  <p style="margin:0 0 16px;"><a href="${SITE_URL}/area-riservata" style="color:#059669;font-weight:bold;">Vai all'area riservata →</a></p>
  <p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [to],
      reply_to: "info@techlanditalia.it",
      subject: title,
      html,
      text: `${body}\n\nIl Team TECHLAND`,
    }),
  });
  if (!res.ok) {
    await captureServerError(new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`), {
      fn: FN,
      fingerprint: [FN, "resend"],
    });
    return false;
  }
  return true;
}

/** Lead della famiglia: prima quello collegato al genitore, poi allo studente. */
async function familyLeadId(supabase: SupabaseClient, p: PauseRow): Promise<string | null> {
  for (const pid of [p.student?.parent_id, p.student_id]) {
    if (!pid) continue;
    const { data } = await supabase
      .from("crm_leads").select("id").eq("linked_profile_id", pid).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return data.id as string;
  }
  return null;
}

async function run(supabase: SupabaseClient): Promise<Summary> {
  const summary: Summary = { resumed: 0, reminders: 0, push_sent: 0, emails_sent: 0, skipped: [] };
  const today = romeToday();

  const { data, error } = await supabase
    .from("subscription_pauses")
    .select("id, student_id, ends_on, reminder_14_sent_at, reminder_7_sent_at, student:profiles!subscription_pauses_student_id_fkey(full_name, email, parent_id)")
    .is("ended_at", null)
    .not("ends_on", "is", null);
  if (error) throw new Error(`subscription_pauses: ${error.message}`);
  // Relazione many-to-one: PostgREST restituisce un oggetto, i tipi generici dicono array
  const pauses = (data ?? []) as unknown as PauseRow[];

  const parentIds = [...new Set(pauses.map((p) => p.student?.parent_id).filter((x): x is string => !!x))];
  const { data: parentRows } = parentIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", parentIds)
    : { data: [] };
  const parents = new Map(((parentRows ?? []) as Profile[]).map((p) => [p.id, p]));

  for (const p of pauses) {
    const studentName = p.student?.full_name || "lo studente";

    // 1. Ripresa automatica
    if (p.ends_on && p.ends_on <= today) {
      const { error: endErr } = await supabase
        .from("subscription_pauses")
        .update({ ended_at: new Date().toISOString(), end_reason: "auto" })
        .eq("id", p.id).is("ended_at", null);
      if (endErr) {
        summary.skipped.push({ student: studentName, reason: `ripresa fallita: ${endErr.message}` });
        continue;
      }
      summary.resumed++;
      const leadId = await familyLeadId(supabase, p);
      if (leadId) {
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          type: "status_change",
          subject: `Pausa terminata: ${studentName} riprende le lezioni`,
          content: `Ripresa automatica il ${p.ends_on.split("-").reverse().join("/")}.`,
          metadata: { pause_id: p.id, student_id: p.student_id, automatic: true },
        });
      }
      continue;
    }

    // 2. Avvisi di fine pausa
    const days = reminderDue({
      today,
      endsOn: p.ends_on,
      sent14: !!p.reminder_14_sent_at,
      sent7: !!p.reminder_7_sent_at,
    });
    if (!days || !p.ends_on) continue;

    const parent = p.student?.parent_id ? parents.get(p.student.parent_id) : undefined;
    const recipientId = parent?.id ?? p.student_id;
    const email = (parent?.email ?? p.student?.email)?.trim();
    const { title, body } = pauseEndingMessage({ studentName, endsOn: p.ends_on, days });

    // Segna prima di inviare: se due esecuzioni si sovrappongono parte un solo avviso
    const column = days === 14 ? "reminder_14_sent_at" : "reminder_7_sent_at";
    const { data: claimed } = await supabase
      .from("subscription_pauses")
      .update({ [column]: new Date().toISOString() })
      .eq("id", p.id).is(column, null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const pushed = await sendPush(supabase, recipientId, title, body);
    const mailed = email ? await sendEmail(email, title, body) : false;
    summary.reminders++;
    summary.push_sent += pushed;
    if (mailed) summary.emails_sent++;
    if (!pushed && !mailed) summary.skipped.push({ student: studentName, reason: "nessuna push attiva e nessuna email" });
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

/**
 * Report mensile per gli admin (drizzle/migrations/0037_monthly_report.sql).
 *
 * Il primo del mese (job pg_cron monthly-report-monthly, header x-cron-token)
 * legge public.monthly_report_stats() per il mese appena chiuso e per quello
 * prima, compone la mail (_shared/monthlyreport.ts) e la manda a tutti gli
 * admin. Il report inviato resta in monthly_reports: se il job ripartisse lo
 * stesso mese non manda una seconda mail.
 *
 * Chiamata anche da un admin con 2FA ("Inviamelo ora" in CRM → Analytics):
 * manda il report solo a lui, anche di un mese a scelta ({ month: "YYYY-MM" }),
 * senza toccare lo storico.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";
import { sendEmail } from "../_shared/email.ts";
import {
  buildReportEmail,
  isMonth,
  monthRange,
  type MonthlyStats,
  previousMonth,
  reportMonth,
} from "../_shared/monthlyreport.ts";

const FN = "monthly-report";
// Stesso crontab del job pg_cron monthly-report-monthly
const MONITOR = { slug: FN, schedule: "0 6 1 * *", marginMinutes: 60, maxRuntimeMinutes: 10 };
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

async function loadStats(supabase: SupabaseClient, month: string): Promise<MonthlyStats> {
  const { from, to } = monthRange(month);
  const { data, error } = await supabase.rpc("monthly_report_stats", { _from: from, _to: to });
  if (error) throw new Error(`monthly_report_stats ${month}: ${error.message}`);
  return data as MonthlyStats;
}

async function adminEmails(supabase: SupabaseClient): Promise<string[]> {
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("email").in("id", ids);
  return [...new Set((profiles ?? []).map((p) => (p.email as string | null)?.trim().toLowerCase()).filter((e): e is string => !!e))];
}

async function run(supabase: SupabaseClient, month: string, recipients: string[], isCron: boolean) {
  if (isCron) {
    const { data: existing } = await supabase
      .from("monthly_reports").select("sent_at").eq("month", month).maybeSingle();
    if (existing?.sent_at) return { month, skipped: "già inviato", sent_to: [] as string[] };
  }

  const [cur, prev] = await Promise.all([loadStats(supabase, month), loadStats(supabase, previousMonth(month))]);
  const mail = buildReportEmail({ month, cur, prev, siteUrl: SITE_URL });

  const sentTo: string[] = [];
  for (const to of recipients) {
    if ((await sendEmail({ kind: "staff_monthly_report", source: FN, to, ...mail })).ok) sentTo.push(to);
  }

  if (isCron) {
    const { error } = await supabase.from("monthly_reports").upsert({
      month,
      stats: { current: cur, previous: prev },
      sent_to: sentTo,
      sent_at: sentTo.length > 0 ? new Date().toISOString() : null,
    });
    if (error) await captureServerError(error, { fn: FN, extra: { month } });
    if (recipients.length > 0 && sentTo.length === 0) {
      throw new Error(`Report di ${month} non inviato a nessuno dei ${recipients.length} admin`);
    }
  }
  return { month, recipients: recipients.length, sent_to: sentTo };
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

  let recipients: string[] = [];
  let month = reportMonth();
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
    if (!user.email) return json({ error: "Il tuo account non ha un indirizzo email" }, 400);

    const body = await req.json().catch(() => ({}));
    if (body?.month !== undefined) {
      if (!isMonth(body.month)) return json({ error: "Mese non valido (YYYY-MM)" }, 400);
      month = body.month;
    }
    recipients = [user.email.toLowerCase()];
  }

  return withCronMonitor(isCron ? MONITOR : null, FN, async () => {
    try {
      if (isCron) recipients = await adminEmails(supabase);
      const summary = await run(supabase, month, recipients, isCron);
      return json({ ok: true, ...summary });
    } catch (err) {
      await captureServerError(err, { fn: FN, tags: { area: "cron" } });
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
});

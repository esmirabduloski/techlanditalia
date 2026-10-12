/**
 * Controllo orario dei job pianificati (pg_cron).
 *
 * Legge public.cron_health_report() (drizzle/migrations/0026_cron_health_check.sql)
 * e, per ogni problema trovato, apre/aggiorna una issue Sentry (una per job e
 * tipo di guasto, grazie al fingerprint) e manda una push riassuntiva agli admin.
 *
 * È a sua volta un monitor Sentry Crons: se pg_cron o pg_net smettono di
 * funzionare questa funzione non viene più chiamata e Sentry segnala il
 * check-in mancato.
 *
 * Chiamata dal cron (header x-cron-token) o da un admin con 2FA, che riceve il
 * report in risposta.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";

const FN = "cron-health-check";
// Stesso crontab del job pg_cron cron-health-check-hourly
const MONITOR = { slug: FN, schedule: "5 * * * *", marginMinutes: 15, maxRuntimeMinutes: 5 };

interface Report {
  failed_runs: { jobname: string | null; start_time: string; message: string | null }[];
  http_failures: { id: number; created: string; status_code: number | null; timed_out: boolean | null; error: string | null }[];
  missing_jobs: { jobname: string; reason: "missing" | "inactive" }[];
  stale_jobs: { jobname: string; last_start: string; max_age: string }[];
}

interface Problem {
  kind: string;
  key: string;
  message: string;
  extra: Record<string, unknown>;
}

function problems(report: Report): Problem[] {
  const out: Problem[] = [];
  for (const r of report.failed_runs) {
    out.push({
      kind: "failed_run",
      key: r.jobname ?? "sconosciuto",
      message: `Job ${r.jobname ?? "sconosciuto"} fallito: ${r.message ?? "nessun messaggio"}`,
      extra: { ...r },
    });
  }
  // Raggruppate per status: lo stesso 401 ogni ora resta una sola issue
  const byStatus = new Map<string, Report["http_failures"]>();
  for (const r of report.http_failures) {
    const key = r.timed_out ? "timeout" : String(r.status_code ?? "errore");
    byStatus.set(key, [...(byStatus.get(key) ?? []), r]);
  }
  for (const [status, rows] of byStatus) {
    out.push({
      kind: "http_failure",
      key: status,
      message: `${rows.length} chiamate pg_net fallite (${status}): ${rows[0].error ?? ""}`.slice(0, 300),
      extra: { responses: rows.slice(0, 10) },
    });
  }
  for (const r of report.missing_jobs) {
    out.push({
      kind: "missing_job",
      key: r.jobname,
      message: r.reason === "missing" ? `Job ${r.jobname} non pianificato` : `Job ${r.jobname} disattivato`,
      extra: { ...r },
    });
  }
  for (const r of report.stale_jobs) {
    out.push({
      kind: "stale_job",
      key: r.jobname,
      message: `Job ${r.jobname} fermo dall'ultima esecuzione del ${r.last_start}`,
      extra: { ...r },
    });
  }
  return out;
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

  // Un admin può chiedere una finestra più lunga, es. { "since": "7 days" }
  let since = "70 minutes";
  if (!isCron) {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.since === "string" && /^\d{1,3} (minutes|hours|days)$/.test(body.since)) since = body.since;
  }

  return withCronMonitor(isCron ? MONITOR : null, FN, async () => {
    const { data, error } = await supabase.rpc("cron_health_report", { _since: since });
    if (error || !data) {
      await captureServerError(error ?? new Error("Report vuoto"), { fn: FN, tags: { area: "cron" } });
      return json({ error: error?.message ?? "Report vuoto" }, 500);
    }

    const report = data as Report;
    const found = problems(report);

    await Promise.all(found.map((p) =>
      captureServerError(new Error(p.message), {
        fn: FN,
        tags: { area: "cron", kind: p.kind, job: p.key },
        extra: p.extra,
        fingerprint: ["cron-health", p.kind, p.key],
      })
    ));

    if (found.length > 0 && isCron) {
      await notifyAdmins({
        title: found.length === 1 ? "⚠️ Problema in un job pianificato" : `⚠️ ${found.length} problemi nei job pianificati`,
        body: found.slice(0, 3).map((p) => p.message.slice(0, 90)).join(" · ") + (found.length > 3 ? ` · +${found.length - 3}` : ""),
        path: "/admin",
        type: "cron_health",
        tag: "cron-health",
      });
    }

    // Il controllo in sé è andato a buon fine anche se ha trovato problemi:
    // quelli diventano issue separate, il check-in di questo monitor resta "ok".
    return json({ ok: true, problems: found.length, report });
  });
});

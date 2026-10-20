/**
 * Riallinea i Google Calendar degli insegnanti collegati (migrazione 0068).
 *
 * La chiama ogni minuto il job pg_cron google-calendar-sync-minute (header
 * x-cron-token), ma solo quando c'è qualcosa da fare: connessioni segnate dai
 * trigger su lezioni, gruppi e corsi, o non allineate da un giorno. Le prende
 * con claim_google_calendar_syncs(), che le prenota per 5 minuti, e si ferma
 * prima del limite di tempo delle edge function: il resto al giro dopo.
 * Pulisce anche le autorizzazioni Google lasciate a metà.
 *
 * Niente monitor Sentry Crons: la funzione non parte ogni minuto (solo quando
 * serve), i check-in risulterebbero mancanti. Gli errori vanno comunque a Sentry.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureServerError } from "../_shared/sentry.ts";
import { googleConfig } from "../_shared/googlecalendar.ts";
import { type Connection, syncConnection } from "../_shared/googlecalendarsync.ts";

const FN = "google-calendar-sync";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
/** Oltre non si comincia un altro insegnante (limite edge function: 150 s). */
const TIME_BUDGET_MS = 100_000;

serve(async (req: Request): Promise<Response> => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const cronToken = req.headers.get("x-cron-token") ?? "";
  const { data: ok } = cronToken
    ? await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken })
    : { data: false };
  if (ok !== true) return json({ error: "Non autorizzato" }, 401);

  const started = Date.now();
  try {
    await supabase.rpc("cleanup_google_oauth_states");

    const cfg = googleConfig((k) => Deno.env.get(k));
    if (!cfg) return json({ ok: true, skipped: "not_configured" });

    const { data, error } = await supabase.rpc("claim_google_calendar_syncs", { p_limit: 20 });
    if (error) throw error;
    const claimed = (data ?? []) as Connection[];

    const results: { teacher_id: string; ok: boolean; status?: string }[] = [];
    for (const conn of claimed) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        // Libera la prenotazione: li riprende il prossimo giro
        await supabase.from("google_calendar_connections").update({ retry_after: null }).eq("teacher_id", conn.teacher_id);
        continue;
      }
      const outcome = await syncConnection(supabase, cfg, conn, { siteUrl: SITE_URL });
      results.push({ teacher_id: conn.teacher_id, ok: outcome.ok, ...(outcome.ok ? {} : { status: outcome.status }) });
      if (!outcome.ok && outcome.status === "error") {
        await captureServerError(new Error(outcome.error), { fn: FN, extra: { teacherId: conn.teacher_id } });
      }
    }
    return json({ ok: true, claimed: claimed.length, results });
  } catch (e) {
    await captureServerError(e, { fn: FN });
    return json({ error: "Sincronizzazione non riuscita" }, 500);
  }
});

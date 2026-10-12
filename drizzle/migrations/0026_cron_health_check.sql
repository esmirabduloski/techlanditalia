-- Avvisi quando i job pianificati si fermano o falliscono.
--
-- pg_cron segna "succeeded" anche quando la edge function risponde 401/500,
-- perché net.http_post è asincrono: l'esito vero finisce in net._http_response.
-- Qui:
--   1. il job dei promemoria lezioni entra nelle migrazioni (prima esisteva solo
--      fuori dal repo, con il token di 0002_cron_token_verification);
--   2. cron_health_report() raccoglie job falliti, chiamate HTTP fallite, job
--      spariti/disattivati e job fermi da troppo tempo;
--   3. ogni ora la edge function cron-health-check legge il report e lo manda a
--      Sentry + push agli admin. È anche un monitor Sentry Crons: se pg_cron o
--      pg_net si fermano del tutto, Sentry segnala il check-in mancato.

INSERT INTO public.internal_cron_tokens(name) VALUES ('cron-health-check') ON CONFLICT DO NOTHING;

-- Job attesi con l'età massima dell'ultima esecuzione prima di considerarli fermi.
-- Va tenuta allineata con i cron.schedule delle migrazioni e con i monitor Sentry
-- nelle edge function.
CREATE OR REPLACE FUNCTION public.cron_expected_jobs()
RETURNS TABLE(jobname text, max_age interval)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  VALUES
    ('send-lesson-reminders-30min'::text, interval '1 hour'),
    ('send-payment-reminders-daily', interval '26 hours'),
    ('blog-auto-publish-hourly', interval '2 hours'),
    ('data-retention-monthly-scan', interval '32 days'),
    ('cleanup-old-logs-nightly', interval '26 hours'),
    ('cron-health-check-hourly', interval '2 hours')
$$;

CREATE OR REPLACE FUNCTION public.cron_health_report(_since interval DEFAULT interval '70 minutes')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  failed_runs jsonb := '[]'::jsonb;
  http_failures jsonb := '[]'::jsonb;
  missing_jobs jsonb := '[]'::jsonb;
  stale_jobs jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    -- Errori SQL del comando del job (es. cleanup_old_logs, funzioni mancanti)
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobname', j.jobname,
      'start_time', d.start_time,
      'message', left(d.return_message, 300)
    ) ORDER BY d.start_time DESC), '[]'::jsonb)
    INTO failed_runs
    FROM cron.job_run_details d
    LEFT JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.status = 'failed' AND d.start_time > now() - _since;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobname', e.jobname,
      'reason', CASE WHEN j.jobid IS NULL THEN 'missing' ELSE 'inactive' END
    )), '[]'::jsonb)
    INTO missing_jobs
    FROM public.cron_expected_jobs() e
    LEFT JOIN cron.job j ON j.jobname = e.jobname
    WHERE j.jobid IS NULL OR NOT j.active;

    -- Job presenti ma senza esecuzioni recenti. Senza alcuna esecuzione registrata
    -- (job appena creato o storico ripulito) non si segnala nulla.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobname', s.jobname,
      'last_start', s.last_start,
      'max_age', s.max_age::text
    )), '[]'::jsonb)
    INTO stale_jobs
    FROM (
      SELECT e.jobname, e.max_age, max(d.start_time) AS last_start
      FROM public.cron_expected_jobs() e
      JOIN cron.job j ON j.jobname = e.jobname AND j.active
      LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
      GROUP BY e.jobname, e.max_age
    ) s
    WHERE s.last_start IS NOT NULL AND s.last_start < now() - s.max_age;
  END IF;

  IF to_regclass('net._http_response') IS NOT NULL THEN
    -- Risposte delle edge function chiamate dai job (e dagli altri trigger pg_net).
    -- pg_net non conserva l'URL: il corpo della risposta indica la funzione/l'errore.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'created', r.created,
      'status_code', r.status_code,
      'timed_out', r.timed_out,
      'error', coalesce(r.error_msg, left(r.content, 300))
    ) ORDER BY r.created DESC), '[]'::jsonb)
    INTO http_failures
    FROM net._http_response r
    WHERE r.created > now() - _since
      AND (r.status_code >= 400 OR r.timed_out IS TRUE OR r.error_msg IS NOT NULL);
  END IF;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'since', _since::text,
    'failed_runs', failed_runs,
    'http_failures', http_failures,
    'missing_jobs', missing_jobs,
    'stale_jobs', stale_jobs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_expected_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_health_report(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_expected_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_health_report(interval) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Promemoria lezioni ogni 30 minuti: la finestra del promemoria "tra un'ora"
    -- è larga 30 minuti (0.75h-1.25h), quindi un passo più lungo salterebbe
    -- lezioni. I doppioni sono già esclusi da push_notification_log.
    -- Toglie anche il job creato fuori dalle migrazioni, qualunque nome abbia.
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname = 'send-lesson-reminders-30min' OR command LIKE '%functions/v1/send-lesson-reminders%';
    PERFORM cron.schedule(
      'send-lesson-reminders-30min',
      '*/30 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/send-lesson-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'send-lesson-reminders')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );

    -- Controllo salute dei job, ogni ora al minuto 5 (dopo i job orari)
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cron-health-check-hourly';
    PERFORM cron.schedule(
      'cron-health-check-hourly',
      '5 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/cron-health-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'cron-health-check')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END
$cron$;

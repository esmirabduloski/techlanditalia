-- Token interni per i cron di data-retention e blog-auto-publish (stesso
-- meccanismo di send-payment-reminders, vedi 0002_cron_token_verification).
--
-- data-retention: dal 27/09 la funzione richiede un admin anche per "scan", quindi
-- la scansione mensile chiamata con la sola chiave anon veniva rifiutata.
-- blog-auto-publish: non aveva nessun controllo, chiunque poteva lanciarla.
-- Ora entrambe accettano il cron solo con l'header x-cron-token.
INSERT INTO public.internal_cron_tokens(name) VALUES ('data-retention') ON CONFLICT DO NOTHING;
INSERT INTO public.internal_cron_tokens(name) VALUES ('blog-auto-publish') ON CONFLICT DO NOTHING;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Scansione mensile: il giorno 1 alle 06:00 UTC (invariata, ora con il token)
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'data-retention-monthly-scan';
    PERFORM cron.schedule(
      'data-retention-monthly-scan',
      '0 6 1 * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/data-retention',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'data-retention')
        ),
        body := '{"action":"scan","trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $job$
    );

    -- Pubblicazione programmata del blog, ogni ora. Toglie anche eventuali job
    -- creati in passato fuori dalle migrazioni che la chiamavano senza token.
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname = 'blog-auto-publish-hourly' OR command LIKE '%functions/v1/blog-auto-publish%';
    PERFORM cron.schedule(
      'blog-auto-publish-hourly',
      '0 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/blog-auto-publish',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'blog-auto-publish')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END
$cron$;

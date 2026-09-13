-- Pulizia periodica dei dati oltre i termini di conservazione dichiarati nella
-- Privacy Policy (richieste, contatti, candidature, chat, iscrizioni newsletter
-- mai confermate, lead CRM non clienti).
--
-- Il job NON cancella nulla da solo: la scansione mensile (cron -> edge function
-- data-retention, azione "scan") conta i record scaduti, crea una "run" in stato
-- pending e avvisa gli admin con notifica push ed email. La cancellazione parte
-- solo quando un admin approva esplicitamente dalla pagina /admin/privacy
-- (azione "approve", che verifica il ruolo admin ed esegue le DELETE).

CREATE TABLE IF NOT EXISTS public.data_retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'rejected')),
  trigger text NOT NULL DEFAULT 'scheduled' CHECK (trigger IN ('scheduled', 'manual')),
  -- [{ id, label, count, cutoff, months|days }]
  summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  notified_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  -- [{ id, deleted }]
  result jsonb,
  note text
);

CREATE INDEX IF NOT EXISTS idx_data_retention_runs_status ON public.data_retention_runs(status, created_at DESC);

ALTER TABLE public.data_retention_runs ENABLE ROW LEVEL SECURITY;

-- Solo gli admin leggono; scritture esclusivamente dalla edge function (service role)
DROP POLICY IF EXISTS "Admins can read data retention runs" ON public.data_retention_runs;
CREATE POLICY "Admins can read data retention runs"
ON public.data_retention_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.data_retention_runs TO authenticated;
GRANT ALL ON public.data_retention_runs TO service_role;

-- Badge in tempo reale nel menu admin
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'data_retention_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.data_retention_runs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- la publication può non esistere in locale
END
$pub$;

-- Scansione mensile: il giorno 1 alle 06:00 (UTC). Stesso meccanismo del trigger
-- Notion (pg_net -> edge function con la chiave anon): la funzione non cancella
-- nulla, quindi la chiamata anonima può al massimo produrre un avviso.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
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
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40'
        ),
        body := '{"action":"scan","trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $job$
    );
  END IF;
END
$cron$;

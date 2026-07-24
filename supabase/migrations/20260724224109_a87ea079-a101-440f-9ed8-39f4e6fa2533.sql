
-- Storage policies: only admins can access backups-json bucket via client
CREATE POLICY "Admins read backups-json"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups-json' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins write backups-json"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups-json' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update backups-json"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'backups-json' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete backups-json"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backups-json' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior jobs with the same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('backup-json-daily','backup-json-cleanup-monthly');
END $$;

-- Daily snapshot at 03:00 UTC
SELECT cron.schedule(
  'backup-json-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/backup-json-snapshot',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', current_setting('app.backup_cron_secret', true)
    ),
    body:=jsonb_build_object('trigger','cron','time', now()::text)
  );
  $$
);

-- Monthly cleanup on the 1st at 04:00 UTC
SELECT cron.schedule(
  'backup-json-cleanup-monthly',
  '0 4 1 * *',
  $$
  SELECT net.http_post(
    url:='https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/backup-json-cleanup',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', current_setting('app.backup_cron_secret', true)
    ),
    body:=jsonb_build_object('trigger','cron','time', now()::text)
  );
  $$
);

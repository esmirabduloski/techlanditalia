
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN ('backup-json-daily','backup-json-cleanup-monthly');
END $$;

SELECT cron.schedule(
  'backup-json-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/backup-json-snapshot',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-source','pg_cron'
    ),
    body:=jsonb_build_object('trigger','cron','time', now()::text)
  );
  $$
);

SELECT cron.schedule(
  'backup-json-cleanup-monthly',
  '0 4 1 * *',
  $$
  SELECT net.http_post(
    url:='https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/backup-json-cleanup',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-source','pg_cron'
    ),
    body:=jsonb_build_object('trigger','cron','time', now()::text)
  );
  $$
);

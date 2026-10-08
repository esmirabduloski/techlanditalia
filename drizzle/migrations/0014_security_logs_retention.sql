-- Conservazione dei log di sicurezza come dichiarato in Privacy Policy (§2.7):
-- limiti di frequenza 24 ore, tentativi di accesso 7 giorni, eventi di
-- sicurezza e accessi amministrativi 90 giorni.
--
-- Prima `security_events` (IP, user agent, email di bot e abusi) non veniva mai
-- cancellata, e `cleanup_rate_limits()` esisteva ma nessun cron la chiamava.
-- Ora le pulisce entrambe il job notturno, insieme alle tabelle di sempre.
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  analytics_deleted int;
  pageviews_deleted int;
  admin_deleted int;
  login_deleted int;
  security_deleted int;
  ratelimit_deleted int;
BEGIN
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS analytics_deleted = ROW_COUNT;

  DELETE FROM public.page_views WHERE entered_at < now() - interval '30 days';
  GET DIAGNOSTICS pageviews_deleted = ROW_COUNT;

  DELETE FROM public.admin_access_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS admin_deleted = ROW_COUNT;

  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '7 days';
  GET DIAGNOSTICS login_deleted = ROW_COUNT;

  DELETE FROM public.security_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS security_deleted = ROW_COUNT;

  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS ratelimit_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'analytics_events', analytics_deleted,
    'page_views', pageviews_deleted,
    'admin_access_logs', admin_deleted,
    'login_attempts', login_deleted,
    'security_events', security_deleted,
    'rate_limits', ratelimit_deleted,
    'cleaned_at', now()
  );
END;
$func$;

-- Solo cron e service role: nessuno dal client deve poter lanciare le DELETE
REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM anon, authenticated, public;

-- (Ri)programma il job notturno: la migrazione originale lo creava solo se
-- pg_cron era già attivo in quel momento.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-old-logs-nightly';
    PERFORM cron.schedule('cleanup-old-logs-nightly', '0 3 * * *', 'SELECT public.cleanup_old_logs();');
  END IF;
END
$cron$;

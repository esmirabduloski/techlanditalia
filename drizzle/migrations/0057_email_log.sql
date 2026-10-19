-- Registro delle email inviate (centro di controllo Email in /admin/email).
--
-- Ogni email che parte da una edge function passa da _shared/email.ts, che dopo
-- la chiamata a Resend scrive qui una riga: tipo (chiave di
-- _shared/emailcatalog.ts), destinatario, oggetto, esito ed eventuale errore.
-- Il corpo (html) si salva solo per le email non sensibili: reset password,
-- codici 2FA, benvenuto con il link per la password, conferma newsletter e
-- newsletter (identica per tutti, con il link di disiscrizione) restano NULL.
--
-- Solo gli admin leggono; scrive solo il service role. Le righe spariscono con
-- l'account del destinatario e comunque dopo 12 mesi (cleanup_old_logs).

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  to_email text NOT NULL,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  subject text NOT NULL,
  html text,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error text,
  provider_id text,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON public.email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_kind_created ON public.email_log(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_to_email ON public.email_log(lower(to_email));
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON public.email_log(recipient_id) WHERE recipient_id IS NOT NULL;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

DROP POLICY IF EXISTS "Admins can view email log" ON public.email_log;
CREATE POLICY "Admins can view email log"
ON public.email_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Conservazione: come 0014_security_logs_retention.sql, più il registro email (12 mesi)
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
  email_deleted int;
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

  DELETE FROM public.email_log WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS email_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'analytics_events', analytics_deleted,
    'page_views', pageviews_deleted,
    'admin_access_logs', admin_deleted,
    'login_attempts', login_deleted,
    'security_events', security_deleted,
    'rate_limits', ratelimit_deleted,
    'email_log', email_deleted,
    'cleaned_at', now()
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM anon, authenticated, public;

SELECT public.ensure_mfa_policies();

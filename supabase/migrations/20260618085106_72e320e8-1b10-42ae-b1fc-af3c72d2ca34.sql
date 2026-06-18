
-- Rate limiting table
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (identifier, endpoint, created_at DESC);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits service only" ON public.rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Security events audit log
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  identifier text,
  ip_address text,
  user_agent text,
  endpoint text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_events_type_created ON public.security_events (event_type, created_at DESC);
CREATE INDEX idx_security_events_severity_created ON public.security_events (severity, created_at DESC);
GRANT ALL ON public.security_events TO service_role;
GRANT SELECT ON public.security_events TO authenticated;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events admin read" ON public.security_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "security_events service write" ON public.security_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Rate limit checker (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _endpoint text,
  _max_requests integer,
  _window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count integer;
  oldest_request timestamptz;
BEGIN
  SELECT COUNT(*), MIN(created_at)
  INTO request_count, oldest_request
  FROM public.rate_limits
  WHERE identifier = _identifier
    AND endpoint = _endpoint
    AND created_at > now() - (_window_seconds || ' seconds')::interval;

  IF request_count >= _max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', request_count,
      'retry_after_seconds',
        GREATEST(1, EXTRACT(EPOCH FROM (oldest_request + (_window_seconds || ' seconds')::interval - now()))::int)
    );
  END IF;

  INSERT INTO public.rate_limits (identifier, endpoint) VALUES (_identifier, _endpoint);

  -- Opportunistic cleanup of old rows for this identifier+endpoint
  DELETE FROM public.rate_limits
  WHERE identifier = _identifier
    AND endpoint = _endpoint
    AND created_at < now() - (_window_seconds || ' seconds')::interval;

  RETURN jsonb_build_object('allowed', true, 'count', request_count + 1);
END;
$$;

-- Cleanup function (call manually or via cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

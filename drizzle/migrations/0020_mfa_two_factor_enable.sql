CREATE OR REPLACE FUNCTION public.mfa_required(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = _user_id AND status = 'verified')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
        AND role IN ('admin'::app_role, 'teacher'::app_role, 'operator'::app_role))
$$;
REVOKE ALL ON FUNCTION public.mfa_required(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_required(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NULL
      OR coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT public.mfa_required(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_mfa_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.mfa_required(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_mfa_required() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mfa_required() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  AND (_user_id IS DISTINCT FROM auth.uid() OR public.mfa_ok())
$$;

CREATE TABLE IF NOT EXISTS public.mfa_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text
);
CREATE INDEX IF NOT EXISTS idx_mfa_reset_requests_user ON public.mfa_reset_requests(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mfa_reset_requests_pending
  ON public.mfa_reset_requests(user_id) WHERE status = 'pending';

GRANT SELECT, UPDATE ON public.mfa_reset_requests TO authenticated;
GRANT ALL ON public.mfa_reset_requests TO service_role;
ALTER TABLE public.mfa_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read mfa reset requests" ON public.mfa_reset_requests;
CREATE POLICY "Admins can read mfa reset requests"
ON public.mfa_reset_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update mfa reset requests" ON public.mfa_reset_requests;
CREATE POLICY "Admins can update mfa reset requests"
ON public.mfa_reset_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_mfa_overview()
RETURNS TABLE (user_id uuid, verified_factors integer, last_enrolled_at timestamptz,
  pending_request_id uuid, pending_request_at timestamptz, pending_request_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH f AS (
    SELECT mf.user_id, count(*)::int AS n, max(mf.created_at) AS last_at
    FROM auth.mfa_factors mf WHERE mf.status = 'verified' GROUP BY mf.user_id
  ), r AS (
    SELECT rr.user_id, rr.id, rr.created_at, rr.note
    FROM public.mfa_reset_requests rr WHERE rr.status = 'pending'
  )
  SELECT coalesce(f.user_id, r.user_id), coalesce(f.n, 0), f.last_at, r.id, r.created_at, r.note
  FROM f FULL OUTER JOIN r ON r.user_id = f.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mfa_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mfa_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_mfa_policies()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND (n.nspname = 'public' OR (n.nspname = 'storage' AND c.relname = 'objects'))
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname
          AND p.tablename = c.relname AND p.policyname = 'mfa_required')
  LOOP
    EXECUTE format(
      'CREATE POLICY mfa_required ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))',
      t.schema_name, t.table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_mfa_policies() FROM PUBLIC, anon, authenticated;

SELECT public.ensure_mfa_policies();
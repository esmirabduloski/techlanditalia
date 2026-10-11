-- Verifica in due passaggi (MFA TOTP nativa di Supabase Auth).
--
-- Regole:
--   * admin, insegnanti e operatori DEVONO avere la 2FA: finché la sessione non
--     è aal2 il database non restituisce nulla (l'app mostra prima la
--     configurazione o la richiesta del codice);
--   * i genitori non la attivano (l'app non lo propone, per non complicare il
--     loro login); se un account avesse comunque un fattore verificato, vale
--     la stessa regola: serve una sessione aal2.
--
-- L'applicazione avviene con una policy RESTRICTIVE su ogni tabella di public
-- (+ storage.objects), che si somma in AND alle policy esistenti senza
-- modificarle. Il service role (edge function, cron) non è toccato.
-- Le tabelle create in futuro vanno coperte richiamando
--   SELECT public.ensure_mfa_policies();
-- alla fine della migrazione che le crea.

-- 1. Chi deve avere la 2FA ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.mfa_required(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = _user_id AND status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin'::app_role, 'teacher'::app_role, 'operator'::app_role)
    )
$$;
REVOKE ALL ON FUNCTION public.mfa_required(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_required(uuid) TO service_role;

-- 2. La sessione corrente soddisfa la 2FA? ------------------------------------
CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NULL
      OR coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT public.mfa_required(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO authenticated, service_role;

-- Per l'app: "devo configurare/verificare la 2FA?" (solo per sé stessi)
CREATE OR REPLACE FUNCTION public.my_mfa_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.mfa_required(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_mfa_required() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mfa_required() TO authenticated;

-- 3. has_role: anche le funzioni SECURITY DEFINER che controllano il ruolo
--    dell'utente corrente richiedono la 2FA. Il ruolo di ALTRI utenti
--    (es. "questo utente è admin?") resta invariato.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
  AND (_user_id IS DISTINCT FROM auth.uid() OR public.mfa_ok())
$$;

-- 4. Richieste di reset 2FA (utente che ha perso l'app) ------------------------
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
-- Al massimo una richiesta aperta per utente
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mfa_reset_requests_pending
  ON public.mfa_reset_requests(user_id) WHERE status = 'pending';

ALTER TABLE public.mfa_reset_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.mfa_reset_requests TO authenticated;
GRANT ALL ON public.mfa_reset_requests TO service_role;

-- Le richieste le crea solo la edge function mfa-recovery (service role)
DROP POLICY IF EXISTS "Admins can read mfa reset requests" ON public.mfa_reset_requests;
CREATE POLICY "Admins can read mfa reset requests"
ON public.mfa_reset_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update mfa reset requests" ON public.mfa_reset_requests;
CREATE POLICY "Admins can update mfa reset requests"
ON public.mfa_reset_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Panoramica per il pannello utenti -----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mfa_overview()
RETURNS TABLE (
  user_id uuid,
  verified_factors integer,
  last_enrolled_at timestamptz,
  pending_request_id uuid,
  pending_request_at timestamptz,
  pending_request_note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH f AS (
    SELECT mf.user_id, count(*)::int AS n, max(mf.created_at) AS last_at
    FROM auth.mfa_factors mf
    WHERE mf.status = 'verified'
    GROUP BY mf.user_id
  ), r AS (
    SELECT rr.user_id, rr.id, rr.created_at, rr.note
    FROM public.mfa_reset_requests rr
    WHERE rr.status = 'pending'
  )
  SELECT coalesce(f.user_id, r.user_id), coalesce(f.n, 0), f.last_at, r.id, r.created_at, r.note
  FROM f
  FULL OUTER JOIN r ON r.user_id = f.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mfa_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mfa_overview() TO authenticated;

-- 6. Policy restrictive su tutte le tabelle -----------------------------------
CREATE OR REPLACE FUNCTION public.ensure_mfa_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND (n.nspname = 'public' OR (n.nspname = 'storage' AND c.relname = 'objects'))
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = n.nspname
          AND p.tablename = c.relname
          AND p.policyname = 'mfa_required'
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY mfa_required ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))',
      t.schema_name, t.table_name
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_mfa_policies() FROM PUBLIC, anon, authenticated;

SELECT public.ensure_mfa_policies();

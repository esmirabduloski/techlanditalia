-- Consenso per gli strumenti di intelligenza artificiale (L. 132/2025, art. 4
-- c. 4): sotto i 14 anni l'accesso all'AI e il trattamento dei dati che ne
-- deriva richiedono il consenso del genitore; dai 14 anni il minore può darlo
-- da solo, se l'informativa è chiara e semplice (art. 4 c. 3).
--
-- L'età la indica il genitore come anno di nascita (student_birth_years). Con
-- il solo anno non sappiamo se il compleanno è passato: lo studente conta come
-- 14+ solo quando li ha certamente compiuti (anno corrente - anno di nascita
-- >= 15). Senza anno decide il genitore.
--
-- Un solo consenso per tutti gli strumenti AI, legato alla versione
-- dell'informativa in vigore (ai_consent_versions). Nessuna riga = nessuno
-- strumento AI: non si chiede nulla e l'accesso è negato. Uno strumento che
-- cambia dati o fornitore richiede una nuova versione, quindi un nuovo consenso.
--
-- Decide sempre il genitore; lo studente 14+ per sé; vale l'ultima decisione.
-- L'admin può solo registrare una revoca. Si scrive solo tramite le funzioni
-- qui sotto: nessun INSERT/UPDATE/DELETE dal client.

CREATE TABLE IF NOT EXISTS public.ai_consent_versions (
  version text PRIMARY KEY,
  published_at date NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_birth_years (
  student_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_year smallint NOT NULL,
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_consents (
  student_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted boolean NOT NULL,
  version text NOT NULL REFERENCES public.ai_consent_versions(version),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_as text NOT NULL CHECK (decided_as IN ('parent', 'student', 'admin')),
  decided_at timestamptz NOT NULL DEFAULT now()
);

-- Storico di ogni decisione: prova del consenso (art. 7.1 GDPR)
CREATE TABLE IF NOT EXISTS public.ai_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted boolean NOT NULL,
  version text NOT NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_as text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_consent_events_student
  ON public.ai_consent_events(student_id, decided_at DESC);

CREATE OR REPLACE FUNCTION public.ai_consents_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_consent_events (student_id, granted, version, decided_by, decided_as, decided_at)
  VALUES (NEW.student_id, NEW.granted, NEW.version, NEW.decided_by, NEW.decided_as, NEW.decided_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_consents_log ON public.ai_consents;
CREATE TRIGGER ai_consents_log
AFTER INSERT OR UPDATE ON public.ai_consents
FOR EACH ROW EXECUTE FUNCTION public.ai_consents_log();

ALTER TABLE public.ai_consent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_birth_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_consent_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ai_consent_versions, public.student_birth_years, public.ai_consents, public.ai_consent_events TO authenticated;
GRANT ALL ON public.ai_consent_versions, public.student_birth_years, public.ai_consents, public.ai_consent_events TO service_role;

DROP POLICY IF EXISTS "Authenticated read ai consent versions" ON public.ai_consent_versions;
CREATE POLICY "Authenticated read ai consent versions"
ON public.ai_consent_versions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Family and admins read birth years" ON public.student_birth_years;
CREATE POLICY "Family and admins read birth years"
ON public.student_birth_years FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Family and admins read ai consents" ON public.ai_consents;
CREATE POLICY "Family and admins read ai consents"
ON public.ai_consents FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Family and admins read ai consent history" ON public.ai_consent_events;
CREATE POLICY "Family and admins read ai consent history"
ON public.ai_consent_events FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Versione dell'informativa in vigore; NULL finché non c'è uno strumento AI
CREATE OR REPLACE FUNCTION public.current_ai_consent_version()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT version FROM public.ai_consent_versions ORDER BY published_at DESC, version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_ai_consent_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_ai_consent_version() TO authenticated, service_role;

-- 14 anni certamente compiuti (vedi in testa). Uso interno: rivela l'età.
CREATE OR REPLACE FUNCTION public.ai_self_consent_age(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce((
    SELECT extract(year FROM (now() AT TIME ZONE 'Europe/Rome'))::int - b.birth_year >= 15
    FROM public.student_birth_years b WHERE b.student_id = _student
  ), false)
$$;
REVOKE ALL ON FUNCTION public.ai_self_consent_age(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_self_consent_age(uuid) TO service_role;

-- L'anno di nascita lo indica il genitore (o l'admin), mai lo studente
CREATE OR REPLACE FUNCTION public.set_student_birth_year(_student uuid, _year int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _this_year int := extract(year FROM (now() AT TIME ZONE 'Europe/Rome'))::int;
  _as text;
BEGIN
  IF _uid IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Non autenticato' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _student AND role = 'student') THEN
    RAISE EXCEPTION 'Studente non trovato' USING ERRCODE = '22023';
  END IF;
  IF public.is_parent_of(_uid, _student) THEN
    _as := 'parent';
  ELSIF public.has_role(_uid, 'admin'::app_role) THEN
    _as := 'admin';
  ELSE
    RAISE EXCEPTION 'Solo il genitore può indicare l''anno di nascita' USING ERRCODE = '42501';
  END IF;
  IF _year IS NULL OR _year < _this_year - 19 OR _year > _this_year - 4 THEN
    RAISE EXCEPTION 'Anno di nascita non valido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_birth_years (student_id, birth_year, set_by, set_at)
  VALUES (_student, _year, _uid, now())
  ON CONFLICT (student_id) DO UPDATE
    SET birth_year = EXCLUDED.birth_year, set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at;

  -- Se con l'anno corretto lo studente non ha 14 anni, il consenso dato da lui non vale
  IF NOT public.ai_self_consent_age(_student) THEN
    UPDATE public.ai_consents
    SET granted = false, decided_by = _uid, decided_as = _as, decided_at = now()
    WHERE student_id = _student AND granted AND decided_as = 'student';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_student_birth_year(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_student_birth_year(uuid, int) TO authenticated;

-- _version è la versione dell'informativa mostrata: per concedere deve essere
-- quella in vigore. Lo studente può sempre revocare per sé.
CREATE OR REPLACE FUNCTION public.set_ai_consent(_student uuid, _granted boolean, _version text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current text := public.current_ai_consent_version();
  _as text;
BEGIN
  IF _uid IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Non autenticato' USING ERRCODE = '42501';
  END IF;
  IF _granted IS NULL THEN
    RAISE EXCEPTION 'Decisione mancante' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _student AND role = 'student') THEN
    RAISE EXCEPTION 'Studente non trovato' USING ERRCODE = '22023';
  END IF;
  IF _current IS NULL THEN
    RAISE EXCEPTION 'Non ci sono ancora strumenti AI da attivare' USING ERRCODE = '22023';
  END IF;

  IF public.is_parent_of(_uid, _student) THEN
    _as := 'parent';
  ELSIF _uid = _student AND (NOT _granted OR public.ai_self_consent_age(_student)) THEN
    _as := 'student';
  ELSIF NOT _granted AND public.has_role(_uid, 'admin'::app_role) THEN
    _as := 'admin';
  ELSE
    RAISE EXCEPTION 'Non puoi decidere per questo studente' USING ERRCODE = '42501';
  END IF;

  IF _granted AND _version IS DISTINCT FROM _current THEN
    RAISE EXCEPTION 'L''informativa è cambiata: ricarica la pagina' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_consents (student_id, granted, version, decided_by, decided_as, decided_at)
  VALUES (_student, _granted, _current, _uid, _as, now())
  ON CONFLICT (student_id) DO UPDATE
    SET granted = EXCLUDED.granted, version = EXCLUDED.version, decided_by = EXCLUDED.decided_by,
        decided_as = EXCLUDED.decided_as, decided_at = EXCLUDED.decided_at;
END;
$$;
REVOKE ALL ON FUNCTION public.set_ai_consent(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_consent(uuid, boolean, text) TO authenticated;

-- Per l'utente collegato: cosa mostrare al posto dello strumento AI. Gli adulti
-- (genitori, insegnanti, admin) non hanno bisogno del consenso: 'adult'.
CREATE OR REPLACE FUNCTION public.my_ai_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH v AS (SELECT public.current_ai_consent_version() AS version)
  SELECT jsonb_build_object(
    'version', v.version,
    'status', CASE
      WHEN v.version IS NULL THEN 'no_tools'
      WHEN p.role IS DISTINCT FROM 'student' THEN 'adult'
      WHEN c.granted IS NULL THEN 'none'
      WHEN NOT c.granted THEN 'revoked'
      WHEN c.version IS DISTINCT FROM v.version THEN 'outdated'
      ELSE 'granted'
    END,
    'allowed', coalesce(
      v.version IS NOT NULL
      AND p.role IS NOT NULL
      AND (p.role <> 'student' OR (c.granted AND c.version = v.version)),
      false),
    'can_self_consent', public.ai_self_consent_age(auth.uid())
  )
  FROM v
  LEFT JOIN public.profiles p ON p.id = auth.uid()
  LEFT JOIN public.ai_consents c ON c.student_id = auth.uid()
  WHERE auth.uid() IS NOT NULL AND public.mfa_ok()
$$;
REVOKE ALL ON FUNCTION public.my_ai_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ai_access() TO authenticated;

-- Per le edge function AI (service role): consenso dato sulla versione in vigore
CREATE OR REPLACE FUNCTION public.ai_access_allowed(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_consents c
    WHERE c.student_id = _student AND c.granted AND c.version = public.current_ai_consent_version()
  )
$$;
REVOKE ALL ON FUNCTION public.ai_access_allowed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_access_allowed(uuid) TO service_role;

-- Nuove tabelle: anche qui serve la 2FA (vedi 0020_mfa_two_factor_enable)
SELECT public.ensure_mfa_policies();

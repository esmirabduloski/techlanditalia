-- Consenso separato per foto e video dei minori (art. 6.1.a, 7 e 8 GDPR;
-- art. 96 L. 633/1941 sul ritratto; art. 10 c.c.).
--
-- Un consenso per finalità, mai uno solo per tutto:
--   lesson_recording  registrazione delle lezioni
--   open_day          foto e video alle giornate di presentazione
--   social            pubblicazione su sito e social
-- Lo dà il genitore, che può revocarlo in qualsiasi momento. Nessuna riga =
-- consenso non dato. L'admin lo vede prima di pubblicare e può registrare una
-- revoca arrivata per email o telefono, ma non può concederlo al posto del
-- genitore. Ogni cambio finisce nello storico (prova del consenso, art. 7.1).
CREATE TABLE IF NOT EXISTS public.media_consents (
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('lesson_recording', 'open_day', 'social')),
  granted boolean NOT NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, purpose)
);

CREATE TABLE IF NOT EXISTS public.media_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_consent_events_student
  ON public.media_consent_events(student_id, decided_at DESC);

-- Chi decide e quando lo stabilisce il server, non il client
CREATE OR REPLACE FUNCTION public.media_consents_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.granted IS NOT DISTINCT FROM OLD.granted THEN
    RETURN OLD;
  END IF;
  NEW.decided_by := auth.uid();
  NEW.decided_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.media_consents_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.media_consent_events (student_id, purpose, granted, decided_by, decided_at)
  VALUES (NEW.student_id, NEW.purpose, NEW.granted, NEW.decided_by, NEW.decided_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_consents_stamp ON public.media_consents;
CREATE TRIGGER media_consents_stamp
BEFORE INSERT OR UPDATE ON public.media_consents
FOR EACH ROW EXECUTE FUNCTION public.media_consents_stamp();

DROP TRIGGER IF EXISTS media_consents_log_insert ON public.media_consents;
CREATE TRIGGER media_consents_log_insert
AFTER INSERT ON public.media_consents
FOR EACH ROW EXECUTE FUNCTION public.media_consents_log();

DROP TRIGGER IF EXISTS media_consents_log_update ON public.media_consents;
CREATE TRIGGER media_consents_log_update
AFTER UPDATE OF granted ON public.media_consents
FOR EACH ROW WHEN (OLD.granted IS DISTINCT FROM NEW.granted)
EXECUTE FUNCTION public.media_consents_log();

ALTER TABLE public.media_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_consent_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.media_consents TO authenticated;
GRANT SELECT ON public.media_consent_events TO authenticated;
GRANT ALL ON public.media_consents, public.media_consent_events TO service_role;

DROP POLICY IF EXISTS "Parents read their children's media consents" ON public.media_consents;
CREATE POLICY "Parents read their children's media consents"
ON public.media_consents FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Parents give media consents" ON public.media_consents;
CREATE POLICY "Parents give media consents"
ON public.media_consents FOR INSERT TO authenticated
WITH CHECK (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Parents change media consents" ON public.media_consents;
CREATE POLICY "Parents change media consents"
ON public.media_consents FOR UPDATE TO authenticated
USING (public.is_parent_of(auth.uid(), student_id))
WITH CHECK (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Admins read media consents" ON public.media_consents;
CREATE POLICY "Admins read media consents"
ON public.media_consents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- L'admin può solo registrare una revoca, mai concedere
DROP POLICY IF EXISTS "Admins record media consent revocations" ON public.media_consents;
CREATE POLICY "Admins record media consent revocations"
ON public.media_consents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND granted = false);

DROP POLICY IF EXISTS "Parents read their children's media consent history" ON public.media_consent_events;
CREATE POLICY "Parents read their children's media consent history"
ON public.media_consent_events FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Admins read media consent history" ON public.media_consent_events;
CREATE POLICY "Admins read media consent history"
ON public.media_consent_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Nuove tabelle: anche qui serve la 2FA (vedi 0020_mfa_two_factor_enable)
SELECT public.ensure_mfa_policies();

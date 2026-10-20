-- Attestati verificabili e condivisibili.
--
-- Sul PDF dell'attestato c'è un QR code che porta a
-- techlanditalia.it/attestato/<codice>: chi ha in mano l'attestato (o il link)
-- può controllare che sia vero, senza account. verify_certificate() è l'unica
-- porta per gli utenti anonimi e restituisce solo questi campi:
--   - attestato privato (di base): iniziali, corso e data. È un minore;
--   - attestato pubblico (shared_at): anche nome per intero, insegnante e
--     competenze, per aggiungerlo a LinkedIn o condividerlo su Instagram.
--
-- Chi lo rende pubblico, come per il consenso AI (0054): il genitore sempre;
-- lo studente per sé solo con 14 anni certamente compiuti
-- (ai_self_consent_age); vale l'ultima decisione. Tornare privato lo possono
-- fare genitore, studente e admin. Se l'anno di nascita corretto porta lo
-- studente sotto i 14 anni, la pubblicazione decisa da lui decade.
-- Si scrive solo con set_certificate_public(): la famiglia ha solo la lettura.

ALTER TABLE public.course_certificates
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_as text CHECK (shared_as IN ('parent', 'student'));

CREATE OR REPLACE FUNCTION public.set_certificate_public(p_certificate_id uuid, p_public boolean)
RETURNS public.course_certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student uuid;
  v_as text;
  v_row public.course_certificates;
BEGIN
  IF v_uid IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;
  IF p_public IS NULL THEN
    RAISE EXCEPTION 'Scelta non valida' USING ERRCODE = '22023';
  END IF;

  SELECT student_id INTO v_student FROM course_certificates WHERE id = p_certificate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attestato non trovato' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_parent_of(v_uid, v_student) THEN
    v_as := 'parent';
  ELSIF v_uid = v_student THEN
    IF p_public AND NOT public.ai_self_consent_age(v_student) THEN
      RAISE EXCEPTION 'Sotto i 14 anni l''attestato lo rende pubblico un genitore' USING ERRCODE = '42501';
    END IF;
    v_as := 'student';
  ELSIF NOT p_public AND public.has_role(v_uid, 'admin'::app_role) THEN
    v_as := 'admin';
  ELSE
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;

  UPDATE course_certificates
  SET shared_at = CASE WHEN p_public THEN now() END,
      shared_by = CASE WHEN p_public THEN v_uid END,
      shared_as = CASE WHEN p_public THEN v_as END
  WHERE id = p_certificate_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_certificate_public(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_certificate_public(uuid, boolean) TO authenticated;

-- Verifica pubblica dal codice stampato sull'attestato (anche senza account)
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS TABLE (
  code text,
  is_public boolean,
  student_name text,
  course_title text,
  course_emoji text,
  teacher_name text,
  issued_on date,
  hard_skills text[],
  soft_skills text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.code,
    c.shared_at IS NOT NULL,
    CASE WHEN c.shared_at IS NOT NULL THEN c.student_name ELSE (
      SELECT string_agg(upper(left(w, 1)) || '.', ' ')
      FROM regexp_split_to_table(btrim(c.student_name), '\s+') AS w
      WHERE w <> ''
    ) END,
    c.course_title,
    c.course_emoji,
    CASE WHEN c.shared_at IS NOT NULL THEN c.teacher_name END,
    c.issued_on,
    CASE WHEN c.shared_at IS NOT NULL THEN c.hard_skills ELSE '{}'::text[] END,
    CASE WHEN c.shared_at IS NOT NULL THEN c.soft_skills ELSE '{}'::text[] END
  FROM public.course_certificates c
  WHERE length(p_code) <= 40 AND c.code = upper(btrim(p_code))
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;

-- Anno di nascita corretto sotto i 14: decade la pubblicazione decisa dallo studente
CREATE OR REPLACE FUNCTION public.certificate_sharing_age_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.ai_self_consent_age(NEW.student_id) THEN
    UPDATE public.course_certificates
    SET shared_at = NULL, shared_by = NULL, shared_as = NULL
    WHERE student_id = NEW.student_id AND shared_as = 'student';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS certificate_sharing_age_check ON public.student_birth_years;
CREATE TRIGGER certificate_sharing_age_check
AFTER INSERT OR UPDATE OF birth_year ON public.student_birth_years
FOR EACH ROW EXECUTE FUNCTION public.certificate_sharing_age_check();

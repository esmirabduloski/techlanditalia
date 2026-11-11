-- Valutazione di un compito anche quando l'alunno non l'ha consegnato.
--
-- Dalla pagina Valutazioni l'insegnante (o l'admin) sceglie alunno e compito
-- e assegna voto e commento. La RPC grade_homework_without_submission crea la
-- riga in homework_submissions già "graded", senza file né note:
--   - l'insegnante può farlo solo per gli alunni dei propri gruppi di quel
--     corso (come la policy "Teachers can grade submissions for their
--     students"), l'admin per tutti;
--   - l'alunno deve essere iscritto al corso del compito;
--   - se l'alunno ha già una consegna la RPC la rifiuta: si valuta quella;
--   - i punti si calcolano come sempre dal voto
--     (trigger calculate_graded_homework_points, sull'UPDATE).
--
-- Una valutazione senza consegna non conta come consegna per la serie di
-- compiti consecutivi (trigger on_homework_submission).
--
-- L'alunno può ancora consegnare dopo: submit_homework_code e
-- submit_homework_file rifiutano solo le consegne valutate che hanno un file o
-- delle note. La consegna torna "in attesa" e l'insegnante la rivaluta; voto e
-- punti restano quelli dati finché non la rivaluta.

CREATE OR REPLACE FUNCTION public.grade_homework_without_submission(
  _homework_id uuid,
  _student_id uuid,
  _grade int,
  _feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _course uuid;
  _submission_id uuid;
  _clean_feedback text := nullif(btrim(coalesce(_feedback, '')), '');
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- SECURITY DEFINER salta le policy: la restrittiva mfa_required va ripetuta qui
  IF NOT public.mfa_ok() THEN
    RETURN jsonb_build_object('success', false, 'error', 'mfa_required');
  END IF;

  IF _grade IS NULL OR _grade < 0 OR _grade > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_grade');
  END IF;

  IF length(coalesce(_clean_feedback, '')) > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_large');
  END IF;

  SELECT COALESCE(l.course_id, h.course_id) INTO _course
  FROM public.homework h
  LEFT JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = _homework_id;

  IF _course IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF NOT (public.has_role(_caller, 'admin')
          OR public.is_teacher_of_student_in_course(_caller, _student_id, _course)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_allowed');
  END IF;

  IF NOT public.is_enrolled_for_homework(_student_id, _homework_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.homework_submissions
    WHERE homework_id = _homework_id AND student_id = _student_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;

  -- Inserita e poi valutata, come una consegna normale: sull'INSERT il trigger
  -- set_homework_points mette sempre i punti pieni, sull'UPDATE
  -- calculate_graded_homework_points li calcola dal voto.
  INSERT INTO public.homework_submissions (homework_id, student_id, status)
  VALUES (_homework_id, _student_id, 'pending')
  RETURNING id INTO _submission_id;

  UPDATE public.homework_submissions
  SET status = 'graded',
      grade = _grade,
      teacher_feedback = _clean_feedback,
      feedback_at = now()
  WHERE id = _submission_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.grade_homework_without_submission(uuid, uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_homework_without_submission(uuid, uuid, int, text) TO authenticated;

-- ── Serie di compiti: conta solo chi ha consegnato qualcosa ────────────────
DROP TRIGGER IF EXISTS on_homework_submission ON public.homework_submissions;
CREATE TRIGGER on_homework_submission
  AFTER INSERT ON public.homework_submissions
  FOR EACH ROW
  WHEN (NEW.file_url IS NOT NULL OR NEW.notes IS NOT NULL)
  EXECUTE FUNCTION public.update_homework_streak();

-- ── Consegna dopo una valutazione senza consegna (codice) ──────────────────
-- Come in 0040_auto_grading.sql; cambia solo il blocco delle consegne valutate.
CREATE OR REPLACE FUNCTION public.submit_homework_code(
  _homework_id uuid,
  _notes text,
  _auto_score int DEFAULT NULL,
  _test_results jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _existing record;
  _has_tests boolean;
  _score int;
  _results jsonb;
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- SECURITY DEFINER salta le policy: la restrittiva mfa_required va ripetuta qui
  IF NOT public.mfa_ok() THEN
    RETURN jsonb_build_object('success', false, 'error', 'mfa_required');
  END IF;

  IF NOT public.is_enrolled_for_homework(_student, _homework_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  IF _notes IS NULL OR btrim(_notes) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty');
  END IF;

  IF length(_notes) > 200000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_large');
  END IF;

  -- Voto proposto solo se il compito ha casi di prova
  SELECT jsonb_array_length(h.test_cases) > 0 INTO _has_tests
  FROM public.homework h WHERE h.id = _homework_id;

  IF coalesce(_has_tests, false) AND _auto_score IS NOT NULL THEN
    _score := least(100, greatest(0, _auto_score));
    _results := CASE WHEN jsonb_typeof(_test_results) = 'array' THEN _test_results ELSE '[]'::jsonb END;
  END IF;

  SELECT id, status, file_url, notes INTO _existing
  FROM public.homework_submissions
  WHERE homework_id = _homework_id AND student_id = _student;

  IF _existing.id IS NULL THEN
    INSERT INTO public.homework_submissions
      (homework_id, student_id, status, notes, file_type, auto_score, test_results, tests_run_at)
    VALUES
      (_homework_id, _student, 'pending', _notes, 'text/code', _score, _results,
       CASE WHEN _score IS NOT NULL THEN now() END);
    RETURN jsonb_build_object('success', true, 'created', true);
  END IF;

  -- Una consegna già valutata non si riscrive (una valutazione senza consegna sì)
  IF _existing.status IN ('graded', 'approved')
     AND (_existing.file_url IS NOT NULL OR _existing.notes IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_graded');
  END IF;

  UPDATE public.homework_submissions
  SET status = 'pending',
      notes = _notes,
      file_type = 'text/code',
      auto_score = _score,
      test_results = _results,
      tests_run_at = CASE WHEN _score IS NOT NULL THEN now() END,
      submitted_at = now()
  WHERE id = _existing.id;

  RETURN jsonb_build_object('success', true, 'created', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_homework_code(uuid, text, int, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_homework_code(uuid, text, int, jsonb) TO authenticated;

-- ── Consegna dopo una valutazione senza consegna (file) ────────────────────
-- Come in 0041_submit_homework_file.sql; cambia solo il blocco delle consegne valutate.
CREATE OR REPLACE FUNCTION public.submit_homework_file(
  _homework_id uuid,
  _file_url text,
  _file_name text,
  _file_type text,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _existing record;
  _clean_notes text := nullif(btrim(coalesce(_notes, '')), '');
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- SECURITY DEFINER salta le policy: la restrittiva mfa_required va ripetuta qui
  IF NOT public.mfa_ok() THEN
    RETURN jsonb_build_object('success', false, 'error', 'mfa_required');
  END IF;

  IF NOT public.is_enrolled_for_homework(_student, _homework_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  IF _file_url IS NULL OR btrim(_file_url) = '' OR _file_name IS NULL OR btrim(_file_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty');
  END IF;

  -- Solo percorsi nella cartella dello studente (come li crea FileUpload.tsx)
  IF left(_file_url, length(_student::text) + 1) <> _student::text || '/'
     OR position('..' IN _file_url) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_file');
  END IF;

  IF length(_file_url) > 1024 OR length(_file_name) > 255 OR length(coalesce(_file_type, '')) > 255
     OR length(coalesce(_clean_notes, '')) > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_large');
  END IF;

  SELECT id, status, file_url, notes INTO _existing
  FROM public.homework_submissions
  WHERE homework_id = _homework_id AND student_id = _student;

  IF _existing.id IS NULL THEN
    INSERT INTO public.homework_submissions
      (homework_id, student_id, status, notes, file_url, file_name, file_type)
    VALUES
      (_homework_id, _student, 'pending', _clean_notes, _file_url, _file_name, _file_type);
    RETURN jsonb_build_object('success', true, 'created', true);
  END IF;

  -- Una consegna già valutata non si riscrive (una valutazione senza consegna sì)
  IF _existing.status IN ('graded', 'approved')
     AND (_existing.file_url IS NOT NULL OR _existing.notes IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_graded');
  END IF;

  UPDATE public.homework_submissions
  SET status = 'pending',
      notes = _clean_notes,
      file_url = _file_url,
      file_name = _file_name,
      file_type = _file_type,
      auto_score = NULL,
      test_results = NULL,
      tests_run_at = NULL,
      submitted_at = now()
  WHERE id = _existing.id;

  RETURN jsonb_build_object('success', true, 'created', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_homework_file(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_homework_file(uuid, text, text, text, text) TO authenticated;

SELECT public.ensure_mfa_policies();

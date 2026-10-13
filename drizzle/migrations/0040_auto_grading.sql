-- Correzione automatica con casi di prova (Python e Web).
--
-- L'admin scrive i casi di prova su task e compiti (colonna test_cases, JSON:
-- formato in src/lib/testCases.ts). I casi sono visibili allo studente e
-- girano nel suo browser: premendo "Verifica" sa subito se il codice funziona.
--   - lesson_tasks.tests_required: per passare alla task successiva bisogna
--     superare tutti i test (controllo nell'interfaccia).
--   - Alla consegna di un compito la % di test superati viene salvata come voto
--     proposto (homework_submissions.auto_score, con il dettaglio in
--     test_results). L'insegnante lo conferma o lo modifica: il voto vero resta
--     grade, impostato solo dall'insegnante.
--
-- La consegna passa dalla RPC submit_homework_code: prima lo studente non
-- poteva aggiornare la propria consegna (nessuna policy UPDATE, "Aggiorna
-- consegna" non cambiava nulla). La RPC riporta la consegna "in attesa",
-- rifiuta quelle già valutate (graded/approved) e non tocca mai voto,
-- feedback e punti.

ALTER TABLE public.lesson_tasks
  ADD COLUMN IF NOT EXISTS test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tests_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS test_cases jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS auto_score int CHECK (auto_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS test_results jsonb,
  ADD COLUMN IF NOT EXISTS tests_run_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_tasks_test_cases_is_array') THEN
    ALTER TABLE public.lesson_tasks
      ADD CONSTRAINT lesson_tasks_test_cases_is_array CHECK (jsonb_typeof(test_cases) = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_test_cases_is_array') THEN
    ALTER TABLE public.homework
      ADD CONSTRAINT homework_test_cases_is_array CHECK (jsonb_typeof(test_cases) = 'array');
  END IF;
END $$;

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

  SELECT id, status INTO _existing
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

  -- Una consegna già valutata non si riscrive
  IF _existing.status IN ('graded', 'approved') THEN
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

SELECT public.ensure_mfa_policies();

-- Consegna di un compito con file allegato (pagina compito-dettaglio).
--
-- Come per il codice (0039_auto_grading.sql, submit_homework_code) lo studente
-- non ha una policy UPDATE su homework_submissions: "Aggiorna consegna" con un
-- nuovo file non cambiava nulla (0 righe, nessun errore). La consegna passa
-- ora dalla RPC submit_homework_file, che:
--   - ripete i controlli delle policy (mfa_ok, iscrizione al corso);
--   - accetta solo file caricati nella cartella dello studente nel bucket
--     homework-files ("<auth.uid()>/..."), non quelli di altri;
--   - rifiuta le consegne già valutate (graded/approved);
--   - riporta la consegna "in attesa" senza toccare voto, feedback e punti;
--   - azzera il voto proposto dei test automatici: valeva per il codice
--     consegnato prima, non per il file.

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

  SELECT id, status INTO _existing
  FROM public.homework_submissions
  WHERE homework_id = _homework_id AND student_id = _student;

  IF _existing.id IS NULL THEN
    INSERT INTO public.homework_submissions
      (homework_id, student_id, status, notes, file_url, file_name, file_type)
    VALUES
      (_homework_id, _student, 'pending', _clean_notes, _file_url, _file_name, _file_type);
    RETURN jsonb_build_object('success', true, 'created', true);
  END IF;

  -- Una consegna già valutata non si riscrive
  IF _existing.status IN ('graded', 'approved') THEN
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

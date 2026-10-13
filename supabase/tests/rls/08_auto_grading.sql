-- Verifica di public.submit_homework_code() (drizzle/migrations/0039_auto_grading.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama la RPC come i vari utenti:
--   - l'alunno iscritto consegna e aggiorna la propria consegna non ancora valutata
--     (anche se l'insegnante l'ha rimandata indietro: torna "in attesa");
--   - una consegna valutata non si riscrive;
--   - niente consegne per corsi a cui non si è iscritti;
--   - il voto proposto si salva solo se il compito ha casi di prova, tra 0 e 100;
--   - la RPC rispetta la verifica in due passaggi (come la policy mfa_required);
--   - gli utenti anonimi non possono chiamarla.

CREATE FUNCTION pg_temp.submit_as(_uid uuid, _aal text, _hw uuid, _notes text, _score int, _results jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE res jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  res := public.submit_homework_code(_hw, _notes, _score, _results);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN res;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  hw1 constant uuid := '00000000-0000-0000-0000-00000000d001';  -- corso C1 (S1, S3)
  hw2 constant uuid := '00000000-0000-0000-0000-00000000d002';  -- corso C2 (S2, S3, S4)
  res jsonb;
  r record;
BEGIN
  UPDATE public.homework SET test_cases = '[{"id":"a","kind":"io","expected":"5"},{"id":"b","kind":"assert","code":"assert True"}]'
  WHERE id = hw1;
  UPDATE public.homework SET test_cases = '[]' WHERE id = hw2;

  BEGIN
    UPDATE public.homework SET test_cases = '{"id":"a"}' WHERE id = hw2;
    RAISE EXCEPTION 'auto_grading: accettati test_cases che non sono un array';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- S1 aggiorna la propria consegna in attesa (prima non poteva: nessuna policy UPDATE)
  res := pg_temp.submit_as(s1, 'aal1', hw1, E'[CODE]\nprint(5)', 50, '[{"id":"a","passed":true},{"id":"b","passed":false}]');
  IF res->>'success' <> 'true' OR res->>'created' <> 'false' THEN
    RAISE EXCEPTION 'auto_grading: S1 non riesce ad aggiornare la consegna: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  IF r.notes <> E'[CODE]\nprint(5)' OR r.auto_score <> 50 OR jsonb_array_length(r.test_results) <> 2
     OR r.tests_run_at IS NULL OR r.status <> 'pending' OR r.grade IS NOT NULL THEN
    RAISE EXCEPTION 'auto_grading: consegna di S1 salvata male: %', to_jsonb(r);
  END IF;

  -- Corso non suo
  res := pg_temp.submit_as(s1, 'aal1', hw2, E'[CODE]\nx', NULL, NULL);
  IF res->>'error' IS DISTINCT FROM 'not_enrolled' THEN
    RAISE EXCEPTION 'auto_grading: S1 consegna un compito di un corso non suo: %', res;
  END IF;
  IF EXISTS (SELECT 1 FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw2) THEN
    RAISE EXCEPTION 'auto_grading: creata una consegna di S1 per il corso C2';
  END IF;

  -- Codice vuoto
  res := pg_temp.submit_as(s1, 'aal1', hw1, '   ', NULL, NULL);
  IF res->>'error' IS DISTINCT FROM 'empty' THEN
    RAISE EXCEPTION 'auto_grading: accettata una consegna vuota: %', res;
  END IF;

  -- Nuova consegna di S3; il voto proposto fuori scala viene riportato a 100
  DELETE FROM public.homework_submissions WHERE student_id = s3 AND homework_id = hw1;
  res := pg_temp.submit_as(s3, 'aal1', hw1, E'[CODE]\nprint(5)', 150, '"non un array"');
  IF res->>'success' <> 'true' OR res->>'created' <> 'true' THEN
    RAISE EXCEPTION 'auto_grading: S3 non riesce a consegnare: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s3 AND homework_id = hw1;
  IF r.student_id IS NULL OR r.auto_score <> 100 OR r.test_results <> '[]'::jsonb OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'auto_grading: nuova consegna di S3 salvata male: %', to_jsonb(r);
  END IF;

  -- Compito senza casi di prova: nessun voto proposto anche se il client lo manda
  res := pg_temp.submit_as(s4, 'aal1', hw2, E'[CODE]\nprint(1)', 90, '[]');
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s4 AND homework_id = hw2;
  IF res->>'success' <> 'true' OR r.auto_score IS NOT NULL OR r.test_results IS NOT NULL THEN
    RAISE EXCEPTION 'auto_grading: voto proposto salvato per un compito senza test: % %', res, to_jsonb(r);
  END IF;

  -- Consegna rivista dall'insegnante ma non valutata: si può riconsegnare
  UPDATE public.homework_submissions SET status = 'reviewed', teacher_feedback = 'Rivedi il ciclo'
  WHERE student_id = s3 AND homework_id = hw1;
  res := pg_temp.submit_as(s3, 'aal1', hw1, E'[CODE]\nprint(6)', 50, '[]');
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s3 AND homework_id = hw1;
  IF res->>'success' <> 'true' OR r.status <> 'pending' OR r.notes <> E'[CODE]\nprint(6)' OR r.teacher_feedback <> 'Rivedi il ciclo' THEN
    RAISE EXCEPTION 'auto_grading: riconsegna dopo la revisione non riuscita: % %', res, to_jsonb(r);
  END IF;

  -- Una consegna valutata non si riscrive (né il codice né il voto)
  UPDATE public.homework_submissions SET status = 'graded', grade = 70
  WHERE student_id = s1 AND homework_id = hw1;
  res := pg_temp.submit_as(s1, 'aal1', hw1, E'[CODE]\nprint("altro")', 100, '[]');
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  IF res->>'error' IS DISTINCT FROM 'already_graded' OR r.notes <> E'[CODE]\nprint(5)' OR r.grade <> 70 OR r.auto_score <> 50 THEN
    RAISE EXCEPTION 'auto_grading: riscritta una consegna già valutata: % %', res, to_jsonb(r);
  END IF;

  -- Utente con 2FA obbligatoria ma sessione aal1: bloccato come dalla policy mfa_required
  res := pg_temp.submit_as(t1, 'aal1', hw1, E'[CODE]\nx', NULL, NULL);
  IF res->>'error' IS DISTINCT FROM 'mfa_required' THEN
    RAISE EXCEPTION 'auto_grading: la RPC ignora la verifica in due passaggi: %', res;
  END IF;

  IF has_function_privilege('anon', 'public.submit_homework_code(uuid, text, int, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'auto_grading: submit_homework_code eseguibile dagli utenti anonimi';
  END IF;

  RAISE NOTICE 'Correzione automatica: consegne verificate';
END $$;

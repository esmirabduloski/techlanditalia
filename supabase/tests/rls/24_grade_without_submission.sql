-- Verifica di public.grade_homework_without_submission()
-- (drizzle/migrations/0080_grade_without_submission.sql).
--   - l'insegnante valuta un compito non consegnato solo per gli alunni dei suoi
--     gruppi di quel corso, l'admin per tutti gli iscritti;
--   - la riga nasce "graded" con voto, commento e punti, senza file né note;
--   - non conta per la serie di compiti consecutivi;
--   - se c'è già una consegna si valuta quella;
--   - dopo, l'alunno può ancora consegnare: torna "in attesa", il voto resta;
--   - verifica in due passaggi, voto 0-100, niente utenti anonimi.

CREATE FUNCTION pg_temp.grade_as(_uid uuid, _aal text, _hw uuid, _student uuid, _grade int, _feedback text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE res jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  res := public.grade_homework_without_submission(_hw, _student, _grade, _feedback);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN res;
END $$;

CREATE FUNCTION pg_temp.submit_file_as(_uid uuid, _hw uuid, _url text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE res jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  res := public.submit_homework_file(_hw, _url, 'compito.png', 'image/png', NULL);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN res;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';  -- C1 (gruppo di T1)
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';  -- C2 (gruppo di T2)
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';  -- C1 e C2
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';  -- C2
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  admin constant uuid := '00000000-0000-0000-0000-000000000901';
  hw1 constant uuid := '00000000-0000-0000-0000-00000000d001';  -- corso C1
  hw2 constant uuid := '00000000-0000-0000-0000-00000000d002';  -- corso C2
  res jsonb;
  r record;
  streak_before jsonb;
  streak_after jsonb;
BEGIN
  UPDATE public.homework SET points_reward = 50 WHERE id = hw1;
  DELETE FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  SELECT to_jsonb(ss) INTO streak_before FROM public.student_streaks ss WHERE student_id = s1;

  -- Chi non può valutare
  res := pg_temp.grade_as(t2, 'aal2', hw1, s1, 70, NULL);
  IF res->>'error' IS DISTINCT FROM 'not_allowed' THEN
    RAISE EXCEPTION 'grade_without: T2 valuta un alunno non suo: %', res;
  END IF;
  res := pg_temp.grade_as(s1, 'aal1', hw1, s1, 100, NULL);
  IF res->>'error' IS DISTINCT FROM 'not_allowed' THEN
    RAISE EXCEPTION 'grade_without: l''alunno si valuta da solo: %', res;
  END IF;
  res := pg_temp.grade_as(t1, 'aal2', hw2, s3, 70, NULL);
  IF res->>'error' IS DISTINCT FROM 'not_allowed' THEN
    RAISE EXCEPTION 'grade_without: T1 valuta un compito di un corso non suo: %', res;
  END IF;
  res := pg_temp.grade_as(t1, 'aal1', hw1, s1, 70, NULL);
  IF res->>'error' IS DISTINCT FROM 'mfa_required' THEN
    RAISE EXCEPTION 'grade_without: la RPC ignora la verifica in due passaggi: %', res;
  END IF;
  res := pg_temp.grade_as(t1, 'aal2', hw1, s1, 101, NULL);
  IF res->>'error' IS DISTINCT FROM 'invalid_grade' THEN
    RAISE EXCEPTION 'grade_without: accettato un voto oltre 100: %', res;
  END IF;
  IF EXISTS (SELECT 1 FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1) THEN
    RAISE EXCEPTION 'grade_without: una chiamata rifiutata ha creato la valutazione';
  END IF;

  -- T1 valuta S1, che non ha consegnato
  res := pg_temp.grade_as(t1, 'aal2', hw1, s1, 70, '  Fatto a voce in classe  ');
  IF res->>'success' <> 'true' THEN
    RAISE EXCEPTION 'grade_without: T1 non riesce a valutare S1: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  IF r.status <> 'graded' OR r.grade <> 70 OR r.points_earned <> 35
     OR r.teacher_feedback <> 'Fatto a voce in classe' OR r.feedback_at IS NULL
     OR r.file_url IS NOT NULL OR r.notes IS NOT NULL THEN
    RAISE EXCEPTION 'grade_without: valutazione di S1 salvata male: %', to_jsonb(r);
  END IF;
  SELECT to_jsonb(ss) INTO streak_after FROM public.student_streaks ss WHERE student_id = s1;
  IF streak_after IS DISTINCT FROM streak_before THEN
    RAISE EXCEPTION 'grade_without: la valutazione senza consegna cambia la serie: % → %', streak_before, streak_after;
  END IF;

  -- Una seconda volta, o con una consegna già fatta: si valuta la consegna
  res := pg_temp.grade_as(t1, 'aal2', hw1, s1, 90, NULL);
  IF res->>'error' IS DISTINCT FROM 'already_submitted' THEN
    RAISE EXCEPTION 'grade_without: valutazione doppia: %', res;
  END IF;
  res := pg_temp.grade_as(t1, 'aal2', hw1, s3, 90, NULL);
  IF res->>'error' IS DISTINCT FROM 'already_submitted' THEN
    RAISE EXCEPTION 'grade_without: scavalcata una consegna di S3: %', res;
  END IF;

  -- S1 consegna dopo: torna in attesa, voto e punti restano finché non si rivaluta
  res := pg_temp.submit_file_as(s1, hw1, s1 || '/dopo.png');
  IF res->>'success' <> 'true' OR res->>'created' <> 'false' THEN
    RAISE EXCEPTION 'grade_without: S1 non riesce a consegnare dopo la valutazione: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  IF r.status <> 'pending' OR r.file_url <> s1 || '/dopo.png' OR r.grade <> 70 OR r.points_earned <> 35 THEN
    RAISE EXCEPTION 'grade_without: consegna dopo la valutazione salvata male: %', to_jsonb(r);
  END IF;

  -- Rivalutata, la consegna con file non si riscrive più
  UPDATE public.homework_submissions SET status = 'graded', grade = 90
  WHERE student_id = s1 AND homework_id = hw1;
  res := pg_temp.submit_file_as(s1, hw1, s1 || '/ancora.png');
  IF res->>'error' IS DISTINCT FROM 'already_graded' THEN
    RAISE EXCEPTION 'grade_without: riscritta una consegna valutata: %', res;
  END IF;

  -- L'admin valuta chiunque sia iscritto, non chi non lo è
  DELETE FROM public.homework_submissions WHERE student_id = s4 AND homework_id = hw2;
  res := pg_temp.grade_as(admin, 'aal2', hw2, s4, 60, NULL);
  IF res->>'success' <> 'true' THEN
    RAISE EXCEPTION 'grade_without: l''admin non riesce a valutare S4: %', res;
  END IF;
  res := pg_temp.grade_as(admin, 'aal2', hw2, s1, 60, NULL);
  IF res->>'error' IS DISTINCT FROM 'not_enrolled' THEN
    RAISE EXCEPTION 'grade_without: l''admin valuta un alunno non iscritto: %', res;
  END IF;

  IF has_function_privilege('anon', 'public.grade_homework_without_submission(uuid, uuid, int, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'grade_without: grade_homework_without_submission eseguibile dagli utenti anonimi';
  END IF;

  RAISE NOTICE 'Valutazione senza consegna: verificata';
END $$;

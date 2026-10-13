-- Verifica di public.submit_homework_file() (drizzle/migrations/0041_submit_homework_file.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama la RPC come i vari utenti:
--   - l'alunno iscritto consegna un file e aggiorna la propria consegna non ancora
--     valutata (torna "in attesa", il feedback resta, il voto proposto si azzera);
--   - una consegna valutata non si riscrive;
--   - niente consegne per corsi a cui non si è iscritti;
--   - solo file nella propria cartella del bucket;
--   - la RPC rispetta la verifica in due passaggi (come la policy mfa_required);
--   - gli utenti anonimi non possono chiamarla.

CREATE FUNCTION pg_temp.submit_file_as(_uid uuid, _aal text, _hw uuid, _url text, _name text, _type text, _notes text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE res jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  res := public.submit_homework_file(_hw, _url, _name, _type, _notes);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN res;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  hw1 constant uuid := '00000000-0000-0000-0000-00000000d001';  -- corso C1 (S1, S3)
  hw2 constant uuid := '00000000-0000-0000-0000-00000000d002';  -- corso C2 (S2, S3, S4)
  res jsonb;
  r record;
BEGIN
  -- Consegna di S3 rimandata indietro, con il voto proposto di un vecchio invio di codice
  UPDATE public.homework_submissions
  SET status = 'reviewed', teacher_feedback = 'Manca il disegno', grade = NULL,
      auto_score = 50, test_results = '[]', tests_run_at = now()
  WHERE student_id = s3 AND homework_id = hw1;

  res := pg_temp.submit_file_as(s3, 'aal1', hw1, s3 || '/disegno-1.png', 'disegno.png', 'image/png', '  Ecco il disegno  ');
  IF res->>'success' <> 'true' OR res->>'created' <> 'false' THEN
    RAISE EXCEPTION 'submit_file: S3 non riesce ad aggiornare la consegna: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s3 AND homework_id = hw1;
  IF r.status <> 'pending' OR r.file_url <> s3 || '/disegno-1.png' OR r.file_name <> 'disegno.png'
     OR r.file_type <> 'image/png' OR r.notes <> 'Ecco il disegno' OR r.teacher_feedback <> 'Manca il disegno'
     OR r.auto_score IS NOT NULL OR r.test_results IS NOT NULL OR r.tests_run_at IS NOT NULL OR r.grade IS NOT NULL THEN
    RAISE EXCEPTION 'submit_file: consegna di S3 salvata male: %', to_jsonb(r);
  END IF;

  -- Nuova consegna di S2
  DELETE FROM public.homework_submissions WHERE student_id = s2 AND homework_id = hw2;
  res := pg_temp.submit_file_as(s2, 'aal1', hw2, s2 || '/compito-1.pdf', 'compito.pdf', 'application/pdf', NULL);
  IF res->>'success' <> 'true' OR res->>'created' <> 'true' THEN
    RAISE EXCEPTION 'submit_file: S2 non riesce a consegnare: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s2 AND homework_id = hw2;
  IF r.status <> 'pending' OR r.file_url <> s2 || '/compito-1.pdf' OR r.notes IS NOT NULL THEN
    RAISE EXCEPTION 'submit_file: nuova consegna di S2 salvata male: %', to_jsonb(r);
  END IF;

  -- Corso non suo
  res := pg_temp.submit_file_as(s2, 'aal1', hw1, s2 || '/x.pdf', 'x.pdf', 'application/pdf', NULL);
  IF res->>'error' IS DISTINCT FROM 'not_enrolled' THEN
    RAISE EXCEPTION 'submit_file: S2 consegna un compito di un corso non suo: %', res;
  END IF;

  -- File nella cartella di un altro alunno, o che ne esce con ..
  res := pg_temp.submit_file_as(s2, 'aal1', hw2, s3 || '/disegno-1.png', 'disegno.png', 'image/png', NULL);
  IF res->>'error' IS DISTINCT FROM 'invalid_file' THEN
    RAISE EXCEPTION 'submit_file: accettato il file di un altro alunno: %', res;
  END IF;
  res := pg_temp.submit_file_as(s2, 'aal1', hw2, s2 || '/../' || s3 || '/disegno-1.png', 'disegno.png', 'image/png', NULL);
  IF res->>'error' IS DISTINCT FROM 'invalid_file' THEN
    RAISE EXCEPTION 'submit_file: accettato un percorso con ..: %', res;
  END IF;
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s2 AND homework_id = hw2;
  IF r.file_url <> s2 || '/compito-1.pdf' THEN
    RAISE EXCEPTION 'submit_file: consegna di S2 cambiata da una chiamata rifiutata: %', to_jsonb(r);
  END IF;

  -- File mancante
  res := pg_temp.submit_file_as(s2, 'aal1', hw2, '', 'x.pdf', 'application/pdf', NULL);
  IF res->>'error' IS DISTINCT FROM 'empty' THEN
    RAISE EXCEPTION 'submit_file: accettata una consegna senza file: %', res;
  END IF;

  -- Una consegna valutata non si riscrive
  UPDATE public.homework_submissions SET status = 'graded', grade = 80, file_url = s1 || '/vecchio.png'
  WHERE student_id = s1 AND homework_id = hw1;
  res := pg_temp.submit_file_as(s1, 'aal1', hw1, s1 || '/nuovo.png', 'nuovo.png', 'image/png', NULL);
  SELECT * INTO r FROM public.homework_submissions WHERE student_id = s1 AND homework_id = hw1;
  IF res->>'error' IS DISTINCT FROM 'already_graded' OR r.file_url <> s1 || '/vecchio.png' OR r.grade <> 80 THEN
    RAISE EXCEPTION 'submit_file: riscritta una consegna già valutata: % %', res, to_jsonb(r);
  END IF;

  UPDATE public.homework_submissions SET status = 'approved' WHERE student_id = s1 AND homework_id = hw1;
  res := pg_temp.submit_file_as(s1, 'aal1', hw1, s1 || '/nuovo.png', 'nuovo.png', 'image/png', NULL);
  IF res->>'error' IS DISTINCT FROM 'already_graded' THEN
    RAISE EXCEPTION 'submit_file: riscritta una consegna approvata: %', res;
  END IF;

  -- Utente con 2FA obbligatoria ma sessione aal1: bloccato come dalla policy mfa_required
  res := pg_temp.submit_file_as(t1, 'aal1', hw1, t1 || '/x.pdf', 'x.pdf', 'application/pdf', NULL);
  IF res->>'error' IS DISTINCT FROM 'mfa_required' THEN
    RAISE EXCEPTION 'submit_file: la RPC ignora la verifica in due passaggi: %', res;
  END IF;

  IF has_function_privilege('anon', 'public.submit_homework_file(uuid, text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'submit_file: submit_homework_file eseguibile dagli utenti anonimi';
  END IF;

  RAISE NOTICE 'Consegna con file: consegne verificate';
END $$;

-- Verifica di public.release_group_certificates() (drizzle/migrations/0050_course_certificates.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama la RPC come i vari utenti:
--   - prima del giorno dell'ultima lezione non si sblocca nulla;
--   - solo l'insegnante del gruppo (con la verifica in due passaggi) o un admin;
--   - ogni alunno attuale del gruppo riceve il proprio attestato, con presenze,
--     ore e competenze del corso fotografate; ripremere non crea doppioni;
--   - senza data in calendario si sblocca quando la presenza dell'ultima
--     lezione è segnata;
--   - gli utenti anonimi non possono chiamarla.

CREATE FUNCTION pg_temp.release_as(_uid uuid, _aal text, _group uuid)
RETURNS SETOF public.course_certificates LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  RETURN QUERY SELECT * FROM public.release_group_certificates(_group);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- Errore atteso dalla RPC: restituisce il messaggio (NULL se non c'è stato errore)
CREATE FUNCTION pg_temp.release_error(_uid uuid, _aal text, _group uuid)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM count(*) FROM pg_temp.release_as(_uid, _aal, _group);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN SQLERRM;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  g2 constant uuid := '00000000-0000-0000-0000-00000000a002';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  err text;
  n int;
  r record;
BEGIN
  -- G1 (S1 con attestato già sbloccato nel seed, S3 senza): 32 lezioni, l'ultima fra 3 giorni
  UPDATE public.student_groups SET max_lessons = 32 WHERE id IN (g1, g2);
  DELETE FROM public.group_lesson_schedule WHERE group_id IN (g1, g2) AND lesson_number = 32;
  INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES (g1, 32, today + 3);
  DELETE FROM public.group_attendance WHERE group_id IN (g1, g2);
  -- S3 in G1: 10 presenze, un'assenza e una giustificata
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status)
  SELECT g1, s3, l, 'present' FROM generate_series(1, 10) AS l;
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES
    (g1, s3, 11, 'absent'), (g1, s3, 12, 'justified');
  -- Competenze di C1: sei tecniche (sull'attestato ne vanno cinque), nessuna trasversale
  UPDATE public.courses SET detail_content = jsonb_build_object('certificate', jsonb_build_object(
    'hardSkills', jsonb_build_array('Uno', 'Due', ' Tre ', 'Quattro', 'Cinque', 'Sei'),
    'softSkills', jsonb_build_array('  ')
  )) WHERE id = c1;

  err := pg_temp.release_error(t1, 'aal2', g1);
  IF err IS NULL OR err NOT LIKE 'Gli attestati si sbloccano il giorno della lezione 32%' THEN
    RAISE EXCEPTION 'certificates: sbloccati prima dell''ultima lezione (%)', err;
  END IF;

  UPDATE public.group_lesson_schedule SET lesson_date = today WHERE group_id = g1 AND lesson_number = 32;

  err := pg_temp.release_error(t2, 'aal2', g1);
  IF err IS NULL THEN RAISE EXCEPTION 'certificates: T2 ha sbloccato gli attestati del gruppo di T1'; END IF;
  err := pg_temp.release_error(t1, 'aal1', g1);
  IF err IS NULL THEN RAISE EXCEPTION 'certificates: T1 ha sbloccato senza verifica in due passaggi'; END IF;
  err := pg_temp.release_error(p1, 'aal1', g1);
  IF err IS NULL THEN RAISE EXCEPTION 'certificates: il genitore P1 ha sbloccato gli attestati'; END IF;
  err := pg_temp.release_error(s1, 'aal1', g1);
  IF err IS NULL THEN RAISE EXCEPTION 'certificates: l''alunno S1 ha sbloccato gli attestati'; END IF;

  -- Il giorno della lezione 32: nasce solo l'attestato di S3 (S1 lo aveva già)
  CREATE TEMP TABLE released ON COMMIT DROP AS SELECT * FROM pg_temp.release_as(t1, 'aal2', g1);
  SELECT count(*) INTO n FROM released;
  IF n <> 1 THEN RAISE EXCEPTION 'certificates: attesi 1 attestato nuovo in G1, creati %', n; END IF;
  SELECT * INTO r FROM released;
  IF r.student_id <> s3 OR r.student_name <> 'Alunno S3' OR r.course_title <> 'Corso C1'
     OR r.teacher_name <> 'Insegnante T1' OR r.lessons_attended <> 10 OR r.lessons_total <> 32
     OR r.hours_attended <> 15.0 OR r.issued_on <> today OR r.released_by <> t1 OR r.notified_at IS NOT NULL
     OR r.hard_skills <> ARRAY['Uno', 'Due', 'Tre', 'Quattro', 'Cinque']
     OR r.soft_skills <> ARRAY['Problem solving', 'Creatività', 'Pensiero logico', 'Perseveranza']
     OR r.code !~ ('^TL-' || extract(year FROM today) || '-[2-9A-HJ-NP-Z]{5}$') THEN
    RAISE EXCEPTION 'certificates: attestato di S3 sbagliato: %', to_jsonb(r);
  END IF;

  -- Ripremere non crea doppioni
  SELECT count(*) INTO n FROM pg_temp.release_as(t1, 'aal2', g1);
  IF n <> 0 THEN RAISE EXCEPTION 'certificates: il secondo sblocco ha creato % attestati', n; END IF;
  SELECT count(*) INTO n FROM public.course_certificates WHERE group_id = g1;
  IF n <> 2 THEN RAISE EXCEPTION 'certificates: in G1 attesi 2 attestati, trovati %', n; END IF;

  -- G2 senza data della lezione 32: serve la presenza dell'ultima lezione
  err := pg_temp.release_error(t2, 'aal2', g2);
  IF err IS NULL OR err NOT LIKE '%segna prima le presenze%' THEN
    RAISE EXCEPTION 'certificates: G2 sbloccato senza data né presenze dell''ultima lezione (%)', err;
  END IF;
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES
    (g2, s4, 32, 'present'), (g2, s2, 32, 'absent');
  -- Anche l'admin può sbloccare: nascono S2 e S4 (S3 lo aveva già dal seed)
  SELECT count(*) INTO n FROM pg_temp.release_as(adm, 'aal2', g2);
  IF n <> 2 THEN RAISE EXCEPTION 'certificates: attesi 2 attestati nuovi in G2, creati %', n; END IF;
  SELECT * INTO r FROM public.course_certificates WHERE group_id = g2 AND student_id = s2;
  IF r.lessons_attended <> 0 OR r.hours_attended <> 0 OR r.released_by <> adm THEN
    RAISE EXCEPTION 'certificates: attestato di S2 sbagliato: %', to_jsonb(r);
  END IF;
  SELECT * INTO r FROM public.course_certificates WHERE group_id = g2 AND student_id = s4;
  IF r.lessons_attended <> 1 OR r.hours_attended <> 1.5 THEN
    RAISE EXCEPTION 'certificates: attestato di S4 sbagliato: %', to_jsonb(r);
  END IF;

  -- Gli anonimi non possono chiamarla
  IF has_function_privilege('anon', 'public.release_group_certificates(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'certificates: gli utenti anonimi possono sbloccare gli attestati';
  END IF;

  -- La migrazione degli attestati richiama ensure_mfa_policies(): non deve
  -- rimettere il blocco 2FA in lettura su courses (0049, elenco corsi pubblico)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'mfa_required') THEN
    RAISE EXCEPTION 'certificates: ensure_mfa_policies() ha rimesso mfa_required su courses';
  END IF;
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'courses' AND policyname LIKE 'mfa\_required\_%';
  IF n <> 3 THEN RAISE EXCEPTION 'certificates: su courses attese 3 regole 2FA in scrittura, trovate %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_certificates' AND policyname = 'mfa_required') THEN
    RAISE EXCEPTION 'certificates: manca la regola 2FA su course_certificates';
  END IF;

  RAISE NOTICE 'Attestati: sblocco, permessi e fotografia OK';
END $$;

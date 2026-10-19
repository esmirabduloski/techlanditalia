-- Mappa delle competenze (drizzle/migrations/0062_skill_map.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova come i vari utenti:
--   - student_skill_evidence conta per concetto le lezioni collegate dei corsi
--     dello studente, quelle incontrate (completate o con presenza), quelle
--     completate e i compiti con un voto (dell'insegnante, altrimenti automatico);
--   - la chiamano solo lo studente, i suoi genitori, i suoi insegnanti e l'admin,
--     e chi ha la 2FA attiva deve aver fatto l'accesso con la 2FA;
--   - solo l'insegnante dello studente (o l'admin) scrive una valutazione, a nome
--     proprio; genitori e alunni la leggono e basta.
-- Mondo di 01_seed.sql: G1 (corso C1, T1) con S1 e S3; G2 (corso C2, T2) con S2,
-- S3, S4; P1 genitore di S1 e S2, P2 di S3. Ogni alunno ha completato la
-- lezione 1 del corso di ogni suo gruppo, con presenza "absent".

CREATE FUNCTION pg_temp.clear_claims() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- Esegue un comando come l'utente: NULL se è riuscito, altrimenti l'errore.
-- Un UPDATE/DELETE/SELECT che non tocca righe è segnalato come 'nessuna riga'.
CREATE FUNCTION pg_temp.run_as(_uid uuid, _aal text, _sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM pg_temp.clear_claims();
  RETURN CASE WHEN n = 0 THEN 'nessuna riga' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM pg_temp.clear_claims();
  RETURN SQLERRM;
END $$;

-- La mappa vista dall'utente, una riga per concetto:
-- concetto:collegate/incontrate/completate/compiti/media/livello insegnante
CREATE FUNCTION pg_temp.evidence_as(_uid uuid, _aal text, _student uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  SELECT coalesce(string_agg(format('%s:%s/%s/%s/%s/%s/%s', e.concept, e.lessons_tagged, e.lessons_met,
           e.lessons_completed, e.homework_scored, coalesce(e.homework_avg::text, '-'),
           coalesce(e.teacher_level::text, '-')), ' ' ORDER BY e.concept), '')
  INTO r FROM public.student_skill_evidence(_student) e;
  RESET ROLE;
  PERFORM pg_temp.clear_claims();
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM pg_temp.clear_claims();
  RETURN 'ERRORE: ' || SQLERRM;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  p2 constant uuid := '00000000-0000-0000-0000-000000000202';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  l1 constant uuid := '00000000-0000-0000-0000-00000000e001';
  l2 constant uuid := '00000000-0000-0000-0000-00000000e002';
  l3 constant uuid := '00000000-0000-0000-0000-00000000e003';
  h1 constant uuid := '00000000-0000-0000-0000-00000000d001';
  h3 constant uuid := '00000000-0000-0000-0000-00000000d003';
  got text;
  want text;
  err text;
BEGIN
  DELETE FROM public.student_skill_assessments;
  -- I test precedenti segnano presenze: si riparte da quelle di 01_seed.sql
  DELETE FROM public.group_attendance WHERE lesson_number <> 1;
  UPDATE public.group_attendance SET status = 'absent';

  -- C1: lezione 1 su cicli e variabili, lezione 2 su cicli e condizioni (con un doppione
  -- nell'array, che non deve contare due volte). C2: lezione 1 sui cicli.
  UPDATE public.lessons SET concepts = '{cicli,variabili}' WHERE id = l1;
  UPDATE public.lessons SET concepts = '{cicli}' WHERE id = l2;
  INSERT INTO public.lessons (id, course_id, lesson_number, title, concepts)
  VALUES (l3, c1, 2, 'Lezione C1 n.2', '{cicli,condizioni,cicli}');
  INSERT INTO public.homework (id, lesson_id, title) VALUES (h3, l3, 'Compito C1 n.2');
  -- Voto dell'insegnante al compito della lezione 1 di S1
  UPDATE public.homework_submissions SET grade = 90 WHERE student_id = s1 AND homework_id = h1;

  want := 'cicli:2/1/1/1/90.0/- condizioni:1/0/0/0/-/- variabili:1/1/1/1/90.0/-';
  got := pg_temp.evidence_as(s1, 'aal1', s1);
  IF got <> want THEN RAISE EXCEPTION 'evidenza S1 vista da S1: atteso "%", ottenuto "%"', want, got; END IF;

  -- Presenza in classe alla lezione 2 (non completata sulla piattaforma) e voto
  -- automatico al suo compito: incontrata sì, completata no, compito contato.
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES (g1, s1, 2, 'present');
  INSERT INTO public.homework_submissions (student_id, homework_id, status, notes, auto_score) VALUES (s1, h3, 'pending', 'consegna', 70);
  want := 'cicli:2/2/1/2/80.0/- condizioni:1/1/0/1/70.0/- variabili:1/1/1/1/90.0/-';
  got := pg_temp.evidence_as(s1, 'aal1', s1);
  IF got <> want THEN RAISE EXCEPTION 'evidenza S1 con presenza e voto automatico: atteso "%", ottenuto "%"', want, got; END IF;

  -- Stessa mappa per tutti quelli che possono vederla
  IF pg_temp.evidence_as(p1, 'aal1', s1) <> want THEN RAISE EXCEPTION 'il genitore P1 non vede la mappa di S1 come S1'; END IF;
  IF pg_temp.evidence_as(t1, 'aal2', s1) <> want THEN RAISE EXCEPTION 'l''insegnante T1 non vede la mappa di S1 come S1'; END IF;
  IF pg_temp.evidence_as(adm, 'aal2', s1) <> want THEN RAISE EXCEPTION 'l''admin non vede la mappa di S1 come S1'; END IF;

  -- S3 è in due corsi: la mappa li somma, anche per T1 che insegna solo in C1
  want := 'cicli:3/2/2/0/-/- condizioni:1/0/0/0/-/- variabili:1/1/1/0/-/-';
  got := pg_temp.evidence_as(p2, 'aal1', s3);
  IF got <> want THEN RAISE EXCEPTION 'evidenza S3 vista da P2: atteso "%", ottenuto "%"', want, got; END IF;
  IF pg_temp.evidence_as(t1, 'aal2', s3) <> want THEN RAISE EXCEPTION 'T1 non vede la mappa completa di S3'; END IF;
  got := pg_temp.evidence_as(adm, 'aal2', s4);
  IF got <> 'cicli:1/1/1/0/-/-' THEN RAISE EXCEPTION 'evidenza S4 vista dall''admin: ottenuto "%"', got; END IF;

  -- Chi non può vederla
  IF pg_temp.evidence_as(s1, 'aal1', s2) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'S1 vede la mappa di S2'; END IF;
  IF pg_temp.evidence_as(p1, 'aal1', s3) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'P1 vede la mappa di S3 (figlio di P2)'; END IF;
  IF pg_temp.evidence_as(t1, 'aal2', s2) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'T1 vede la mappa di S2 (non è nei suoi gruppi)'; END IF;
  IF pg_temp.evidence_as(t1, 'aal1', s1) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'T1 senza 2FA vede la mappa di S1'; END IF;
  IF pg_temp.evidence_as(adm, 'aal1', s1) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'l''admin senza 2FA vede la mappa di S1'; END IF;
  IF pg_temp.evidence_as(NULL, 'aal1', s1) NOT LIKE 'ERRORE:%' THEN RAISE EXCEPTION 'senza utente si vede la mappa di S1'; END IF;

  RAISE NOTICE 'Mappa delle competenze: conteggi e accessi ok';

  -- Valutazioni: solo l'insegnante dello studente, a nome proprio
  err := pg_temp.run_as(t1, 'aal2', format(
    $q$INSERT INTO public.student_skill_assessments (student_id, concept, level, note, assessed_by) VALUES (%L, 'cicli', 3, 'Li usa anche nei progetti liberi', %L)$q$, s1, t1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'T1 non riesce a valutare S1 (%)', err; END IF;
  got := pg_temp.evidence_as(p1, 'aal1', s1);
  IF got NOT LIKE 'cicli:2/2/1/2/80.0/3 %' THEN RAISE EXCEPTION 'la valutazione di T1 non compare nella mappa di S1: "%"', got; END IF;

  -- Una valutazione senza lezioni collegate compare comunque
  err := pg_temp.run_as(t1, 'aal2', format(
    $q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'debug', 1, %L)$q$, s1, t1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'T1 non riesce a valutare il debug di S1 (%)', err; END IF;
  got := pg_temp.evidence_as(s1, 'aal1', s1);
  IF got NOT LIKE '% debug:0/0/0/0/-/1 %' THEN RAISE EXCEPTION 'la valutazione senza lezioni non compare: "%"', got; END IF;

  -- Il nome di chi ha valutato arriva a studente e genitore
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p1::text, true);
  SELECT e.assessed_by_name || ' / ' || e.teacher_note INTO got FROM public.student_skill_evidence(s1) e WHERE e.concept = 'cicli';
  PERFORM pg_temp.clear_claims();
  IF got IS DISTINCT FROM 'Insegnante T1 / Li usa anche nei progetti liberi' THEN
    RAISE EXCEPTION 'nome o nota della valutazione: ottenuto "%"', got;
  END IF;

  -- Upsert come fa l'app (INSERT ... ON CONFLICT DO UPDATE)
  err := pg_temp.run_as(t1, 'aal2', format(
    $q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'cicli', 2, %L)
       ON CONFLICT (student_id, concept) DO UPDATE SET level = excluded.level, note = excluded.note, assessed_by = excluded.assessed_by$q$, s1, t1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'T1 non riesce a cambiare la valutazione di S1 (%)', err; END IF;
  IF (SELECT level FROM public.student_skill_assessments WHERE student_id = s1 AND concept = 'cicli') <> 2 THEN
    RAISE EXCEPTION 'l''upsert di T1 non ha cambiato il livello';
  END IF;

  -- Scritture vietate
  IF pg_temp.run_as(t1, 'aal2', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'cicli', 1, %L)$q$, s2, t1)) IS NULL THEN
    RAISE EXCEPTION 'T1 ha valutato S2, che non è nei suoi gruppi';
  END IF;
  IF pg_temp.run_as(t1, 'aal2', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'liste', 1, %L)$q$, s1, t2)) IS NULL THEN
    RAISE EXCEPTION 'T1 ha scritto una valutazione a nome di T2';
  END IF;
  IF pg_temp.run_as(t1, 'aal1', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'liste', 1, %L)$q$, s1, t1)) IS NULL THEN
    RAISE EXCEPTION 'T1 senza 2FA ha valutato S1';
  END IF;
  IF pg_temp.run_as(p1, 'aal1', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'liste', 3, %L)$q$, s1, p1)) IS NULL THEN
    RAISE EXCEPTION 'il genitore P1 ha valutato il figlio';
  END IF;
  IF pg_temp.run_as(s1, 'aal1', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'liste', 3, %L)$q$, s1, s1)) IS NULL THEN
    RAISE EXCEPTION 'S1 si è valutato da solo';
  END IF;
  IF pg_temp.run_as(p1, 'aal1', format($q$UPDATE public.student_skill_assessments SET level = 3 WHERE student_id = %L$q$, s1)) IS DISTINCT FROM 'nessuna riga'
     OR pg_temp.run_as(s1, 'aal1', format($q$UPDATE public.student_skill_assessments SET level = 3 WHERE student_id = %L$q$, s1)) IS DISTINCT FROM 'nessuna riga'
     OR pg_temp.run_as(t2, 'aal2', format($q$UPDATE public.student_skill_assessments SET level = 3 WHERE student_id = %L$q$, s1)) IS DISTINCT FROM 'nessuna riga'
     OR pg_temp.run_as(t2, 'aal2', format($q$DELETE FROM public.student_skill_assessments WHERE student_id = %L$q$, s1)) IS DISTINCT FROM 'nessuna riga' THEN
    RAISE EXCEPTION 'un genitore, l''alunno o un altro insegnante hanno modificato le valutazioni di S1';
  END IF;

  -- Dati non validi
  IF pg_temp.run_as(t1, 'aal2', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'liste', 5, %L)$q$, s1, t1)) IS NULL THEN
    RAISE EXCEPTION 'accettato un livello fuori scala';
  END IF;
  IF pg_temp.run_as(t1, 'aal2', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, assessed_by) VALUES (%L, 'Liste!', 1, %L)$q$, s1, t1)) IS NULL THEN
    RAISE EXCEPTION 'accettato un concetto con un id non valido';
  END IF;
  IF pg_temp.run_as(t1, 'aal2', format($q$INSERT INTO public.student_skill_assessments (student_id, concept, level, note, assessed_by) VALUES (%L, 'liste', 1, repeat('x', 501), %L)$q$, s1, t1)) IS NULL THEN
    RAISE EXCEPTION 'accettata una nota troppo lunga';
  END IF;

  -- Lettura: il genitore vede le valutazioni dei figli e non quelle degli altri
  IF pg_temp.run_as(p1, 'aal1', format('SELECT 1 FROM public.student_skill_assessments WHERE student_id = %L', s1)) IS NOT NULL THEN
    RAISE EXCEPTION 'il genitore P1 non vede le valutazioni di S1';
  END IF;
  IF pg_temp.run_as(p2, 'aal1', format('SELECT 1 FROM public.student_skill_assessments WHERE student_id = %L', s1)) IS DISTINCT FROM 'nessuna riga' THEN
    RAISE EXCEPTION 'il genitore P2 vede le valutazioni di S1';
  END IF;

  -- Torna al calcolo automatico
  err := pg_temp.run_as(t1, 'aal2', format($q$DELETE FROM public.student_skill_assessments WHERE student_id = %L AND concept = 'debug'$q$, s1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'T1 non riesce a togliere la valutazione (%)', err; END IF;
  got := pg_temp.evidence_as(s1, 'aal1', s1);
  IF got LIKE '%debug%' THEN RAISE EXCEPTION 'la valutazione tolta è ancora nella mappa: "%"', got; END IF;

  -- Pulizia
  DELETE FROM public.student_skill_assessments;
  DELETE FROM public.homework_submissions WHERE homework_id = h3;
  DELETE FROM public.group_attendance WHERE group_id = g1 AND student_id = s1 AND lesson_number = 2;
  DELETE FROM public.homework WHERE id = h3;
  DELETE FROM public.lessons WHERE id = l3;
  UPDATE public.lessons SET concepts = '{}' WHERE id IN (l1, l2);
  UPDATE public.homework_submissions SET grade = NULL WHERE student_id = s1 AND homework_id = h1;

  RAISE NOTICE 'Mappa delle competenze: valutazioni degli insegnanti ok';
END $$;

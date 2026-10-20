-- Compiti stagionali (drizzle/migrations/0066_seasonal_homework.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova temi e compiti come i vari utenti:
--   - i temi li leggono alunni, genitori e insegnanti, li scrive solo l'admin con 2FA;
--   - l'admin crea un compito stagionale in archivio, lo inserisce in una lezione,
--     lo sposta e lo toglie; la lezione deve essere del corso del compito;
--   - un compito normale senza lezione e un secondo compito per lo stesso tema e
--     corso vengono rifiutati;
--   - chi è nel corso vede il compito, chi non c'è no; in archivio non si consegna;
--   - tolto il compito, l'insegnante del corso vede e corregge ancora la consegna;
--   - cancellare la lezione rimette il compito in archivio (con le consegne).
--
-- Mondo di 01_seed.sql: corso C1 (lezione e001, gruppo G1 di T1: S1, S3),
-- corso C2 (lezione e002, gruppo G2 di T2: S2, S3, S4); P1 genitore di S1 e S2.

-- Esegue un comando come l'utente: NULL se è riuscito, altrimenti l'errore.
-- Un UPDATE/DELETE bloccato dall'RLS non dà errore ma non tocca righe: lo segnala come tale.
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
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN CASE WHEN n = 0 THEN 'nessuna riga' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN SQLERRM;
END $$;

-- Esegue una query che restituisce un numero (es. un conteggio) come l'utente.
CREATE FUNCTION pg_temp.count_as(_uid uuid, _aal text, _sql text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql INTO n;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN n;
END $$;

-- Temi
DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  q constant text := 'SELECT count(*) FROM public.seasonal_themes';
  err text;
  got text;
BEGIN
  SELECT string_agg(emoji || ' ' || name || ' (' || period_hint || ')', ', ' ORDER BY sort_order) INTO got
  FROM public.seasonal_themes;
  IF got IS DISTINCT FROM '🎃 Halloween (fine ottobre), 🎄 Natale (dicembre), 🎭 Carnevale (febbraio), ☀️ Estate (giugno)' THEN
    RAISE EXCEPTION 'seasonal_themes: temi iniziali inattesi: %', got;
  END IF;
  IF EXISTS (SELECT 1 FROM public.seasonal_themes WHERE prompt NOT LIKE 'Crea una mappa, degli oggetti o un gioco a tema ' || name || '%') THEN
    RAISE EXCEPTION 'seasonal_themes: un tema iniziale non ha la richiesta standard';
  END IF;

  IF pg_temp.count_as(s1, 'aal1', q) <> 4 OR pg_temp.count_as(p1, 'aal1', q) <> 4 OR pg_temp.count_as(t1, 'aal2', q) <> 4 THEN
    RAISE EXCEPTION 'seasonal_themes: alunno, genitore o insegnante non vedono tutti i temi';
  END IF;

  -- Scrittura: solo l'admin con 2FA
  IF pg_temp.run_as(s1, 'aal1', $q$INSERT INTO public.seasonal_themes (name) VALUES ('Finto')$q$) IS NULL
     OR pg_temp.run_as(p1, 'aal1', $q$INSERT INTO public.seasonal_themes (name) VALUES ('Finto')$q$) IS NULL
     OR pg_temp.run_as(t1, 'aal2', $q$INSERT INTO public.seasonal_themes (name) VALUES ('Finto')$q$) IS NULL
     OR pg_temp.run_as(adm, 'aal1', $q$INSERT INTO public.seasonal_themes (name) VALUES ('Finto')$q$) IS NULL THEN
    RAISE EXCEPTION 'seasonal_themes: un non-admin (o l''admin senza 2FA) ha aggiunto un tema';
  END IF;
  IF pg_temp.run_as(p1, 'aal1', $q$UPDATE public.seasonal_themes SET prompt = 'Cambiato'$q$) IS NULL
     OR pg_temp.run_as(t1, 'aal2', $q$UPDATE public.seasonal_themes SET prompt = 'Cambiato'$q$) IS NULL
     OR pg_temp.run_as(s1, 'aal1', $q$DELETE FROM public.seasonal_themes$q$) IS NULL
     OR pg_temp.run_as(adm, 'aal1', $q$DELETE FROM public.seasonal_themes$q$) IS NULL THEN
    RAISE EXCEPTION 'seasonal_themes: un non-admin (o l''admin senza 2FA) ha modificato o cancellato un tema';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.seasonal_themes (name, emoji, prompt, sort_order) VALUES ('Pasqua', '🐣', 'Crea un gioco a tema Pasqua', 5)$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'seasonal_themes: l''admin non riesce ad aggiungere (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', $q$UPDATE public.seasonal_themes SET period_hint = 'aprile' WHERE name = 'Pasqua'$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'seasonal_themes: l''admin non riesce a modificare (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', $q$DELETE FROM public.seasonal_themes WHERE name = 'Pasqua'$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'seasonal_themes: l''admin non riesce a cancellare (%)', err; END IF;

  -- Dati non validi
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.seasonal_themes (name) VALUES ('Halloween')$q$) IS NULL THEN
    RAISE EXCEPTION 'seasonal_themes: accettato un tema doppione';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.seasonal_themes (name) VALUES ('   ')$q$) IS NULL THEN
    RAISE EXCEPTION 'seasonal_themes: accettato un tema senza nome';
  END IF;

  IF (SELECT count(*) FROM public.seasonal_themes) <> 4 THEN
    RAISE EXCEPTION 'seasonal_themes: attesi 4 temi alla fine';
  END IF;

  RAISE NOTICE 'Temi stagionali: ok';
END $$;

-- Compiti: archivio, inserimento, spostamento, consegne e cancellazione della lezione
DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  c2 constant uuid := '00000000-0000-0000-0000-00000000c002';
  e001 constant uuid := '00000000-0000-0000-0000-00000000e001';
  e002 constant uuid := '00000000-0000-0000-0000-00000000e002';
  -- Seconda lezione di C1, solo per questo test
  e003 constant uuid := '00000000-0000-0000-0000-00000000e003';
  -- Compiti stagionali Halloween di C1 e C2, compito normale nella lezione e003
  hw1 constant uuid := '00000000-0000-0000-0000-00000000d101';
  hw2 constant uuid := '00000000-0000-0000-0000-00000000d102';
  hwn constant uuid := '00000000-0000-0000-0000-00000000d103';
  hal uuid;
  nat uuid;
  err text;
  r record;
BEGIN
  SELECT id INTO hal FROM public.seasonal_themes WHERE name = 'Halloween';
  SELECT id INTO nat FROM public.seasonal_themes WHERE name = 'Natale';
  INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES (e003, c1, 2, 'Lezione 2 C1');

  -- L'admin crea il compito di C1 in archivio
  err := pg_temp.run_as(adm, 'aal2', format(
    $q$INSERT INTO public.homework (id, title, seasonal_theme_id, course_id) VALUES (%L, '🎃 Missione Halloween', %L, %L)$q$, hw1, hal, c1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework: l''admin non riesce a creare un compito stagionale in archivio (%)', err; END IF;
  IF pg_temp.run_as(t1, 'aal2', format(
       $q$INSERT INTO public.homework (title, seasonal_theme_id, course_id) VALUES ('Finto', %L, %L)$q$, nat, c1)) IS NULL THEN
    RAISE EXCEPTION 'homework: un insegnante ha creato un compito stagionale';
  END IF;

  -- In archivio non si consegna
  IF pg_temp.run_as(s1, 'aal1', format(
       $q$INSERT INTO public.homework_submissions (student_id, homework_id, status, notes) VALUES (%L, %L, 'pending', 'x')$q$, s1, hw1)) IS NULL THEN
    RAISE EXCEPTION 'homework_submissions: un alunno ha consegnato un compito in archivio';
  END IF;

  -- Forme non valide
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.homework (title) VALUES ('Senza lezione')$q$) IS NULL THEN
    RAISE EXCEPTION 'homework: accettato un compito normale senza lezione';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', format(
       $q$INSERT INTO public.homework (title, lesson_id, course_id) VALUES ('Corso senza tema', %L, %L)$q$, e001, c1)) IS NULL THEN
    RAISE EXCEPTION 'homework: accettato un compito con corso ma senza tema';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', format(
       $q$INSERT INTO public.homework (title, seasonal_theme_id) VALUES ('Tema senza corso', %L)$q$, nat)) IS NULL THEN
    RAISE EXCEPTION 'homework: accettato un compito stagionale senza corso';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', format(
       $q$INSERT INTO public.homework (title, seasonal_theme_id, course_id) VALUES ('Halloween bis', %L, %L)$q$, hal, c1)) IS NULL THEN
    RAISE EXCEPTION 'homework: accettato un secondo compito per lo stesso tema e corso';
  END IF;
  err := pg_temp.run_as(adm, 'aal2', format(
    $q$INSERT INTO public.homework (title, seasonal_theme_id, course_id, lesson_id) VALUES ('Lezione sbagliata', %L, %L, %L)$q$, nat, c1, e002));
  IF err IS NULL OR err NOT LIKE '%solo in una lezione del suo corso%' THEN
    RAISE EXCEPTION 'homework: accettato un compito stagionale in una lezione di un altro corso (%)', err;
  END IF;

  -- Lo stesso tema per C2, già dentro la sua lezione
  err := pg_temp.run_as(adm, 'aal2', format(
    $q$INSERT INTO public.homework (id, title, seasonal_theme_id, course_id, lesson_id) VALUES (%L, '🎃 Missione Halloween', %L, %L, %L)$q$, hw2, hal, c2, e002));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework: l''admin non riesce a creare il compito di C2 nella sua lezione (%)', err; END IF;

  -- Inserisce il compito di C1 nella lezione 1
  err := pg_temp.run_as(adm, 'aal2', format($q$UPDATE public.homework SET lesson_id = %L WHERE id = %L$q$, e001, hw1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework: l''admin non riesce a inserire il compito nella lezione (%)', err; END IF;

  -- Chi è nel corso lo vede, chi non c'è no
  IF pg_temp.count_as(s1, 'aal1', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 1
     OR pg_temp.count_as(p1, 'aal1', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 1
     OR pg_temp.count_as(t1, 'aal2', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 1 THEN
    RAISE EXCEPTION 'homework: alunno, genitore o insegnante del corso non vedono il compito inserito';
  END IF;
  IF pg_temp.count_as(s1, 'aal1', format('SELECT count(*) FROM public.homework WHERE id = %L', hw2)) <> 0
     OR pg_temp.count_as(s2, 'aal1', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 0
     OR pg_temp.count_as(t2, 'aal2', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 0 THEN
    RAISE EXCEPTION 'homework: un compito stagionale è visibile fuori dal suo corso';
  END IF;

  -- Nella lezione si consegna
  err := pg_temp.run_as(s1, 'aal1', format(
    $q$INSERT INTO public.homework_submissions (student_id, homework_id, status, notes) VALUES (%L, %L, 'pending', 'La mia mappa')$q$, s1, hw1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework_submissions: l''alunno non riesce a consegnare il compito inserito (%)', err; END IF;

  -- Spostamento: nella lezione 2 sì, in una lezione di C2 no
  err := pg_temp.run_as(adm, 'aal2', format($q$UPDATE public.homework SET lesson_id = %L WHERE id = %L$q$, e003, hw1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework: l''admin non riesce a spostare il compito (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', format($q$UPDATE public.homework SET lesson_id = %L WHERE id = %L$q$, e002, hw1));
  IF err IS NULL OR err NOT LIKE '%solo in una lezione del suo corso%' THEN
    RAISE EXCEPTION 'homework: spostato un compito stagionale in una lezione di un altro corso (%)', err;
  END IF;
  IF (SELECT lesson_id FROM public.homework WHERE id = hw1) IS DISTINCT FROM e003 THEN
    RAISE EXCEPTION 'homework: dopo lo spostamento il compito non è nella lezione 2';
  END IF;

  -- Togli: torna in archivio, la consegna resta
  err := pg_temp.run_as(adm, 'aal2', format($q$UPDATE public.homework SET lesson_id = NULL WHERE id = %L$q$, hw1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework: l''admin non riesce a togliere il compito (%)', err; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.homework_submissions WHERE homework_id = hw1 AND student_id = s1) THEN
    RAISE EXCEPTION 'homework_submissions: togliere il compito ha cancellato la consegna';
  END IF;
  IF pg_temp.run_as(s3, 'aal1', format(
       $q$INSERT INTO public.homework_submissions (student_id, homework_id, status, notes) VALUES (%L, %L, 'pending', 'x')$q$, s3, hw1)) IS NULL THEN
    RAISE EXCEPTION 'homework_submissions: un alunno ha consegnato un compito tolto dalla lezione';
  END IF;
  -- L'alunno ritrova la sua consegna con il titolo del compito
  IF pg_temp.count_as(s1, 'aal1', format(
       'SELECT count(*) FROM public.homework_submissions hs JOIN public.homework h ON h.id = hs.homework_id WHERE hs.homework_id = %L', hw1)) <> 1 THEN
    RAISE EXCEPTION 'homework: l''alunno non ritrova la consegna di un compito tolto';
  END IF;
  IF pg_temp.count_as(s2, 'aal1', format('SELECT count(*) FROM public.homework WHERE id = %L', hw1)) <> 0 THEN
    RAISE EXCEPTION 'homework: un compito in archivio è visibile fuori dal suo corso';
  END IF;

  -- L'insegnante del corso vede e corregge ancora la consegna, l'altro no
  IF pg_temp.count_as(t1, 'aal2', format('SELECT count(*) FROM public.homework_submissions WHERE homework_id = %L', hw1)) <> 1 THEN
    RAISE EXCEPTION 'homework_submissions: l''insegnante non vede più la consegna di un compito tolto';
  END IF;
  IF pg_temp.count_as(t2, 'aal2', format('SELECT count(*) FROM public.homework_submissions WHERE homework_id = %L', hw1)) <> 0 THEN
    RAISE EXCEPTION 'homework_submissions: un insegnante di un altro corso vede la consegna';
  END IF;
  err := pg_temp.run_as(t1, 'aal2', format(
    $q$UPDATE public.homework_submissions SET status = 'graded', grade = 90, teacher_feedback = 'Bellissima' WHERE homework_id = %L AND student_id = %L$q$, hw1, s1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'homework_submissions: l''insegnante non riesce a correggere la consegna di un compito tolto (%)', err; END IF;
  IF pg_temp.run_as(t2, 'aal2', format(
       $q$UPDATE public.homework_submissions SET teacher_feedback = 'Altro' WHERE homework_id = %L$q$, hw1)) IS DISTINCT FROM 'nessuna riga' THEN
    RAISE EXCEPTION 'homework_submissions: un insegnante di un altro corso ha corretto la consegna';
  END IF;
  SELECT status, grade, teacher_feedback INTO r FROM public.homework_submissions WHERE homework_id = hw1 AND student_id = s1;
  IF r.status <> 'graded' OR r.grade <> 90 OR r.teacher_feedback <> 'Bellissima' THEN
    RAISE EXCEPTION 'homework_submissions: correzione non salvata (%)', r;
  END IF;

  -- Cancellare la lezione rimette in archivio il compito stagionale (con la consegna);
  -- il compito normale della lezione se ne va come prima
  UPDATE public.homework SET lesson_id = e003 WHERE id = hw1;
  INSERT INTO public.homework (id, lesson_id, title) VALUES (hwn, e003, 'Compito normale lezione 2');
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lessons WHERE id = %L', e003));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'lessons: l''admin non riesce a cancellare la lezione (%)', err; END IF;
  IF (SELECT lesson_id FROM public.homework WHERE id = hw1) IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.homework WHERE id = hw1) THEN
    RAISE EXCEPTION 'lessons: cancellando la lezione il compito stagionale non è tornato in archivio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.homework_submissions WHERE homework_id = hw1 AND student_id = s1) THEN
    RAISE EXCEPTION 'lessons: cancellando la lezione è sparita la consegna del compito stagionale';
  END IF;
  IF EXISTS (SELECT 1 FROM public.homework WHERE id = hwn) THEN
    RAISE EXCEPTION 'lessons: cancellando la lezione il compito normale è rimasto';
  END IF;

  -- Un tema con dei compiti non si cancella
  IF pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.seasonal_themes WHERE id = %L', hal)) IS NULL THEN
    RAISE EXCEPTION 'seasonal_themes: cancellato un tema che ha dei compiti';
  END IF;

  -- Pulizia
  DELETE FROM public.homework WHERE id IN (hw1, hw2);

  RAISE NOTICE 'Compiti stagionali: archivio, lezioni, consegne e correzioni ok';
END $$;

-- Corso cancellato: lezioni e compiti stagionali se ne vanno insieme, senza errori
DO $$
DECLARE
  c3 constant uuid := '00000000-0000-0000-0000-00000000c003';
  e301 constant uuid := '00000000-0000-0000-0000-00000000e301';
BEGIN
  INSERT INTO public.courses (id, slug, title, is_visible) VALUES (c3, 'test-c3', 'Corso C3', false);
  INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES (e301, c3, 1, 'Lezione C3');
  INSERT INTO public.homework (title, seasonal_theme_id, course_id, lesson_id)
  SELECT 'Missione ' || name, id, c3, CASE WHEN sort_order = 1 THEN e301 END
  FROM public.seasonal_themes WHERE sort_order IN (1, 2);

  DELETE FROM public.courses WHERE id = c3;
  IF EXISTS (SELECT 1 FROM public.homework WHERE course_id = c3) THEN
    RAISE EXCEPTION 'courses: cancellando il corso sono rimasti i suoi compiti stagionali';
  END IF;

  RAISE NOTICE 'Compiti stagionali: cancellazione del corso ok';
END $$;

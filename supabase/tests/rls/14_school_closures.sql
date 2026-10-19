-- Calendario di chiusure e festività (drizzle/migrations/0060_school_closures.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova la tabella come i vari utenti:
--   - genitori, alunni e insegnanti leggono tutte le chiusure (sono di tutta la scuola);
--   - solo l'admin con 2FA aggiunge, modifica e cancella;
--   - date al contrario e doppioni (stesso giorno, stesso nome) vengono rifiutati;
--   - school_closure_audience sceglie le famiglie con lezione nei giorni chiusi
--     (gruppi attivi, già iniziati, calendario non finito) e solo il service role la chiama;
--   - il calendario generato alla creazione del gruppo salta i giorni di chiusura;
--   - se l'admin sposta le date di una chiusura non ancora iniziata, l'avviso riparte.

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

CREATE FUNCTION pg_temp.count_as(_uid uuid, _aal text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.school_closures;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN n;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  err text;
  n int;
BEGIN
  INSERT INTO public.school_closures (title, start_date, end_date, note) VALUES
    ('Vacanze di Natale', '2026-12-23', '2027-01-06', 'Le lezioni riprendono giovedì 7 gennaio'),
    ('Immacolata Concezione', '2026-12-08', '2026-12-08', NULL);

  IF pg_temp.count_as(p1, 'aal1') <> 2 OR pg_temp.count_as(s1, 'aal1') <> 2 OR pg_temp.count_as(t1, 'aal2') <> 2 THEN
    RAISE EXCEPTION 'school_closures: genitore, alunno o insegnante non vedono tutte le chiusure';
  END IF;

  -- Scrittura: solo l'admin con 2FA
  IF pg_temp.run_as(p1, 'aal1', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Finta', '2027-02-01', '2027-02-01')$q$) IS NULL
     OR pg_temp.run_as(t1, 'aal2', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Finta', '2027-02-01', '2027-02-01')$q$) IS NULL
     OR pg_temp.run_as(adm, 'aal1', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Finta', '2027-02-01', '2027-02-01')$q$) IS NULL THEN
    RAISE EXCEPTION 'school_closures: un non-admin (o l''admin senza 2FA) ha aggiunto una chiusura';
  END IF;
  IF pg_temp.run_as(p1, 'aal1', $q$UPDATE public.school_closures SET title = 'Cambiata'$q$) IS NULL
     OR pg_temp.run_as(t1, 'aal2', $q$DELETE FROM public.school_closures$q$) IS NULL
     OR pg_temp.run_as(adm, 'aal1', $q$DELETE FROM public.school_closures$q$) IS NULL THEN
    RAISE EXCEPTION 'school_closures: un non-admin (o l''admin senza 2FA) ha modificato o cancellato una chiusura';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Ponte', '2027-04-26', '2027-04-26')$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'school_closures: l''admin non riesce ad aggiungere (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', $q$UPDATE public.school_closures SET end_date = '2027-04-27' WHERE title = 'Ponte'$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'school_closures: l''admin non riesce a modificare (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', $q$DELETE FROM public.school_closures WHERE title = 'Ponte'$q$);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'school_closures: l''admin non riesce a cancellare (%)', err; END IF;

  -- Dati non validi
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Al contrario', '2027-03-10', '2027-03-09')$q$) IS NULL THEN
    RAISE EXCEPTION 'school_closures: accettata una chiusura che finisce prima di iniziare';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Immacolata Concezione', '2026-12-08', '2026-12-08')$q$) IS NULL THEN
    RAISE EXCEPTION 'school_closures: accettato un doppione';
  END IF;
  IF pg_temp.run_as(adm, 'aal2', $q$INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('   ', '2027-03-10', '2027-03-10')$q$) IS NULL THEN
    RAISE EXCEPTION 'school_closures: accettata una chiusura senza nome';
  END IF;

  SELECT count(*) INTO n FROM public.school_closures;
  IF n <> 2 THEN RAISE EXCEPTION 'school_closures: attese 2 chiusure alla fine, sono %', n; END IF;

  RAISE NOTICE 'Calendario chiusure: ok';
END $$;

-- Famiglie da avvisare, calendario dei nuovi gruppi e reset dell'avviso.
-- Mondo di 01_seed.sql: G1 il lunedì (S1, S3), G2 il martedì (S2, S3, S4), entrambi
-- iniziati oggi; P1 genitore di S1 e S2, P2 di S3, S4 senza genitore.
CREATE FUNCTION pg_temp.audience(_closure uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(recipient_id::text, 3) || ':' || (
           SELECT string_agg(right(x::text, 3), ',' ORDER BY x) FROM unnest(student_ids) x),
         ' ' ORDER BY recipient_id), '')
  FROM public.school_closure_audience(_closure);
$$;

DO $$
DECLARE
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  -- Il primo lunedì dopo oggi
  mon constant date := current_date + (8 - extract(isodow FROM current_date)::int);
  g3 constant uuid := '00000000-0000-0000-0000-00000000a003';
  cid uuid;
  got text;
  first_lesson date;
  err text;
BEGIN
  DELETE FROM public.school_closures;

  -- Solo lunedì: G1
  INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Lunedì chiuso', mon, mon) RETURNING id INTO cid;
  got := pg_temp.audience(cid);
  IF got <> '201:101 202:103' THEN RAISE EXCEPTION 'audience lunedì: atteso "201:101 202:103", ottenuto "%"', got; END IF;

  -- Lunedì e martedì: G1 e G2, un solo avviso per famiglia, S4 avvisato direttamente
  UPDATE public.school_closures SET end_date = mon + 1 WHERE id = cid;
  got := pg_temp.audience(cid);
  IF got <> '104:104 201:101,102 202:103' THEN
    RAISE EXCEPTION 'audience lunedì-martedì: atteso "104:104 201:101,102 202:103", ottenuto "%"', got;
  END IF;

  -- Oltre la fine dei calendari di G1 e G2: nessuno
  UPDATE public.school_closures SET start_date = mon + 700, end_date = mon + 701 WHERE id = cid;
  got := pg_temp.audience(cid);
  IF got <> '' THEN RAISE EXCEPTION 'audience a calendario finito: atteso nessuno, ottenuto "%"', got; END IF;

  -- Solo il service role chiama la funzione
  err := pg_temp.run_as(p1, 'aal1', format('SELECT * FROM public.school_closure_audience(%L)', cid));
  IF err IS NULL OR err = 'nessuna riga' THEN RAISE EXCEPTION 'school_closure_audience: un genitore la può chiamare'; END IF;

  -- Nuovo gruppo G3 il mercoledì da tra due settimane: il primo mercoledì è chiuso
  INSERT INTO public.school_closures (title, start_date, end_date) VALUES ('Mercoledì chiuso', mon + 16, mon + 16) RETURNING id INTO cid;
  INSERT INTO public.student_groups (id, title, course_id, teacher_id, status, start_date, lesson_days, lesson_time, max_lessons)
  VALUES (g3, 'Gruppo G3', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000301', 'active', mon + 14, '{3}', '17:00', 4);
  INSERT INTO public.group_students (group_id, student_id) VALUES (g3, s4);
  SELECT lesson_date INTO first_lesson FROM public.group_lesson_schedule WHERE group_id = g3 AND lesson_number = 1;
  IF first_lesson IS DISTINCT FROM mon + 23 THEN
    RAISE EXCEPTION 'calendario G3: la prima lezione doveva saltare la chiusura (atteso %, ottenuto %)', mon + 23, first_lesson;
  END IF;
  IF (SELECT count(*) FROM public.group_lesson_schedule WHERE group_id = g3) <> 4 THEN
    RAISE EXCEPTION 'calendario G3: attese 4 lezioni';
  END IF;

  -- S4 di mercoledì avrebbe avuto lezione: va avvisato
  got := pg_temp.audience(cid);
  IF got <> '104:104' THEN RAISE EXCEPTION 'audience mercoledì: atteso "104:104", ottenuto "%"', got; END IF;
  -- Prima dell'inizio di G3 nessuno
  UPDATE public.school_closures SET start_date = mon + 2, end_date = mon + 2 WHERE id = cid;
  got := pg_temp.audience(cid);
  IF got <> '' THEN RAISE EXCEPTION 'audience prima dell''inizio del gruppo: atteso nessuno, ottenuto "%"', got; END IF;
  -- Gruppo archiviato: nessuno
  UPDATE public.school_closures SET start_date = mon + 16, end_date = mon + 16 WHERE id = cid;
  UPDATE public.student_groups SET status = 'archived' WHERE id = g3;
  got := pg_temp.audience(cid);
  IF got <> '' THEN RAISE EXCEPTION 'audience gruppo archiviato: atteso nessuno, ottenuto "%"', got; END IF;

  -- Avviso già partito: cambiare il nome non lo ripete, spostare le date sì
  UPDATE public.school_closures SET notified_at = now() WHERE id = cid;
  UPDATE public.school_closures SET title = 'Mercoledì: formazione' WHERE id = cid;
  IF (SELECT notified_at FROM public.school_closures WHERE id = cid) IS NULL THEN
    RAISE EXCEPTION 'school_closures: cambiare solo il nome ha azzerato l''avviso';
  END IF;
  UPDATE public.school_closures SET end_date = mon + 17 WHERE id = cid;
  IF (SELECT notified_at FROM public.school_closures WHERE id = cid) IS NOT NULL THEN
    RAISE EXCEPTION 'school_closures: spostare le date non ha azzerato l''avviso';
  END IF;
  -- Chiusura già iniziata: l'avviso resta
  UPDATE public.school_closures SET start_date = current_date - 1, end_date = current_date + 1, notified_at = now() WHERE id = cid;
  UPDATE public.school_closures SET end_date = current_date + 2 WHERE id = cid;
  IF (SELECT notified_at FROM public.school_closures WHERE id = cid) IS NULL THEN
    RAISE EXCEPTION 'school_closures: allungare una chiusura già iniziata ha azzerato l''avviso';
  END IF;

  -- Pulizia: G3 e le chiusure di prova
  DELETE FROM public.student_groups WHERE id = g3;
  DELETE FROM public.school_closures;

  RAISE NOTICE 'Avviso chiusure: famiglie, calendario e reset ok';
END $$;

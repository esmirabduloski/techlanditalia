-- Tutorial "come consegnare i compiti" per corso (drizzle/migrations/0088_course_homework_tutorials.sql).
--   - lo vedono gli studenti iscritti al corso e l'admin; non gli altri studenti, i genitori, gli anonimi;
--   - lo scrive solo l'admin con 2FA;
--   - video: un link https oppure un file, non entrambi; i file stanno nella cartella del corso;
--   - bucket course-tutorials privato: i file si leggono solo se si è iscritti al corso.
-- Mondo di 01_seed.sql: C1 con S1 e S3, C2 con S2, S3 e S4; P1 genitore di S1 e S2.

CREATE FUNCTION pg_temp.login(_uid uuid, _aal text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
    PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  END IF;
END $$;

CREATE FUNCTION pg_temp.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- Esegue _sql come l'utente: NULL se va, altrimenti l'errore ('nessuna riga' se non tocca niente)
CREATE FUNCTION pg_temp.run_as(_uid uuid, _aal text, _sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN CASE WHEN n = 0 THEN 'nessuna riga' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN SQLERRM;
END $$;

-- Corsi di cui l'utente vede il tutorial (NULL = anonimo)
CREATE FUNCTION pg_temp.tutorials_of(_uid uuid, _aal text) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE res uuid[];
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  IF _uid IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  SELECT coalesce(array_agg(course_id ORDER BY course_id), '{}') INTO res FROM public.course_homework_tutorials;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN res;
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN '{}';
END $$;

-- File del bucket course-tutorials visibili all'utente
CREATE FUNCTION pg_temp.files_of(_uid uuid, _aal text) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE res text[];
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  IF _uid IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  SELECT coalesce(array_agg(name ORDER BY name), '{}') INTO res FROM storage.objects WHERE bucket_id = 'course-tutorials';
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN res;
END $$;

-- true se l'utente riesce a caricare il file
CREATE FUNCTION pg_temp.can_upload(_uid uuid, _aal text, _name text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE ok boolean := true;
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('course-tutorials', _name, _uid);
  EXCEPTION WHEN insufficient_privilege THEN
    ok := false;
  END;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN ok;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  c2 constant uuid := '00000000-0000-0000-0000-00000000c002';
  err text;
BEGIN
  -- Il bucket è privato
  IF (SELECT public FROM storage.buckets WHERE id = 'course-tutorials') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'tutorial: il bucket course-tutorials non esiste o è pubblico';
  END IF;

  -- L'admin con 2FA crea il tutorial di C1 (link) e di C2 (file + PDF)
  err := pg_temp.run_as(adm, 'aal2', format(
    'INSERT INTO public.course_homework_tutorials (course_id, video_url, pdf_path) VALUES (%L, %L, %L)',
    c1, 'https://www.youtube.com/watch?v=abc123', c1 || '/guida.pdf'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'tutorial: l''admin non crea il tutorial con il link: %', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', format(
    'INSERT INTO public.course_homework_tutorials (course_id, video_path, pdf_path) VALUES (%L, %L, %L)',
    c2, c2 || '/video.mp4', c2 || '/guida.pdf'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'tutorial: l''admin non crea il tutorial con il file: %', err; END IF;

  -- Senza 2FA l'admin no
  IF pg_temp.run_as(adm, 'aal1', format(
       'UPDATE public.course_homework_tutorials SET pdf_path = NULL WHERE course_id = %L', c1)) IS NULL THEN
    RAISE EXCEPTION 'tutorial: admin senza 2FA modifica il tutorial';
  END IF;

  -- Chi lo vede: lo studente i corsi a cui è iscritto, l'admin tutti; genitori, insegnanti e anonimi no
  IF pg_temp.tutorials_of(s1, 'aal1') <> ARRAY[c1]
     OR pg_temp.tutorials_of(s2, 'aal1') <> ARRAY[c2]
     OR pg_temp.tutorials_of(s3, 'aal1') <> ARRAY[c1, c2]
     OR pg_temp.tutorials_of(adm, 'aal2') <> ARRAY[c1, c2] THEN
    RAISE EXCEPTION 'tutorial: studenti o admin non vedono i tutorial giusti';
  END IF;
  IF pg_temp.tutorials_of(p1, 'aal1') <> '{}' OR pg_temp.tutorials_of(t1, 'aal1') <> '{}'
     OR pg_temp.tutorials_of(NULL, 'aal1') <> '{}' THEN
    RAISE EXCEPTION 'tutorial: genitore, insegnante o anonimo vedono un tutorial';
  END IF;

  -- Studenti e insegnanti non lo modificano
  IF pg_temp.run_as(s1, 'aal1', format(
       'UPDATE public.course_homework_tutorials SET video_url = %L WHERE course_id = %L', 'https://evil.test', c1)) IS NULL
     OR pg_temp.run_as(t1, 'aal1', format(
       'DELETE FROM public.course_homework_tutorials WHERE course_id = %L', c1)) IS NULL
     OR pg_temp.run_as(s1, 'aal1', format(
       'INSERT INTO public.course_homework_tutorials (course_id, video_url) VALUES (%L, %L)', c2, 'https://evil.test')) IS NULL THEN
    RAISE EXCEPTION 'tutorial: uno studente o un insegnante modificano il tutorial';
  END IF;

  -- Solo https, un solo video, file nella cartella del proprio corso
  IF pg_temp.run_as(adm, 'aal2', format(
       'UPDATE public.course_homework_tutorials SET video_url = %L WHERE course_id = %L', 'javascript:alert(1)', c1)) IS NULL
     OR pg_temp.run_as(adm, 'aal2', format(
       'UPDATE public.course_homework_tutorials SET video_path = %L WHERE course_id = %L', c1 || '/video.mp4', c1)) IS NULL
     OR pg_temp.run_as(adm, 'aal2', format(
       'UPDATE public.course_homework_tutorials SET pdf_path = %L WHERE course_id = %L', c2 || '/guida.pdf', c1)) IS NULL THEN
    RAISE EXCEPTION 'tutorial: accettati un link non https, due video o un file di un altro corso';
  END IF;

  -- Bucket: carica solo l'admin con 2FA, legge chi è iscritto al corso
  IF NOT pg_temp.can_upload(adm, 'aal2', c1 || '/guida.pdf') OR NOT pg_temp.can_upload(adm, 'aal2', c2 || '/video.mp4') THEN
    RAISE EXCEPTION 'tutorial: l''admin non carica i file';
  END IF;
  IF pg_temp.can_upload(s1, 'aal1', c1 || '/mio.pdf') OR pg_temp.can_upload(t1, 'aal1', c1 || '/doc.pdf') THEN
    RAISE EXCEPTION 'tutorial: uno studente o un insegnante caricano nel bucket dei tutorial';
  END IF;
  IF pg_temp.files_of(s1, 'aal1') <> ARRAY[c1 || '/guida.pdf']
     OR pg_temp.files_of(s2, 'aal1') <> ARRAY[c2 || '/video.mp4']
     OR pg_temp.files_of(p1, 'aal1') <> '{}' OR pg_temp.files_of(NULL, 'aal1') <> '{}' THEN
    RAISE EXCEPTION 'tutorial: i file del bucket li vede chi non è iscritto al corso';
  END IF;

  -- Togliere il tutorial cancella la riga
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.course_homework_tutorials WHERE course_id = %L', c1));
  IF err IS NOT NULL OR pg_temp.tutorials_of(s1, 'aal1') <> '{}' OR pg_temp.tutorials_of(s3, 'aal1') <> ARRAY[c2] THEN
    RAISE EXCEPTION 'tutorial: l''admin non lo toglie: %', err;
  END IF;

  RAISE NOTICE 'Tutorial consegna compiti: visibile agli iscritti al corso e all''admin; lo scrive solo l''admin con 2FA';
END $$;

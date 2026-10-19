-- File degli studenti in spazi privati (drizzle/migrations/0055_student_files_private.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova lo storage come i vari utenti:
--   - i bucket con file degli studenti sono privati;
--   - nessun bucket pubblico accetta file caricati da uno studente;
--   - student-web-assets: lo studente carica e cancella solo nella propria cartella
--     e vede solo i propri file; l'insegnante vede quelli degli alunni dei suoi
--     gruppi, il genitore quelli dei figli, l'admin tutti, gli anonimi niente;
--   - una cartella che non è un uuid non manda in errore le policy.

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

-- File del bucket visibili all'utente (NULL = anonimo)
CREATE FUNCTION pg_temp.visible(_uid uuid, _aal text, _bucket text) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE res text[];
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  IF _uid IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  SELECT coalesce(array_agg(name ORDER BY name), '{}') INTO res FROM storage.objects WHERE bucket_id = _bucket;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN res;
END $$;

-- true se l'utente riesce a caricare il file
CREATE FUNCTION pg_temp.can_upload(_uid uuid, _aal text, _bucket text, _name text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE ok boolean := true;
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  IF _uid IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES (_bucket, _name, _uid);
  EXCEPTION WHEN insufficient_privilege THEN
    ok := false;
  END;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN ok;
END $$;

-- Quanti file l'utente riesce a cancellare
CREATE FUNCTION pg_temp.deleted(_uid uuid, _aal text, _bucket text, _name text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.login(_uid, _aal);
  SET LOCAL ROLE authenticated;
  DELETE FROM storage.objects WHERE bucket_id = _bucket AND name = _name;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM pg_temp.logout();
  RETURN n;
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
  b constant text := 'student-web-assets';
  f1 text := s1 || '/gatto-1.png';
  f2 text := s2 || '/cane-1.png';
  f3 text := s3 || '/stile-1.css';
  r record;
  seen text[];
BEGIN
  -- Bucket privati
  FOR r IN SELECT id, public FROM storage.buckets
           WHERE id IN ('homework-files', 'group-certificates', 'student-web-assets') LOOP
    IF r.public THEN RAISE EXCEPTION 'storage: il bucket % è pubblico', r.id; END IF;
  END LOOP;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('homework-files', 'group-certificates', 'student-web-assets')) <> 3 THEN
    RAISE EXCEPTION 'storage: manca uno dei bucket con file degli studenti';
  END IF;

  -- Nessun bucket pubblico accetta file degli studenti
  FOR r IN SELECT id FROM storage.buckets WHERE public LOOP
    IF pg_temp.can_upload(s1, 'aal1', r.id, s1 || '/prova.png') OR pg_temp.can_upload(s1, 'aal1', r.id, 'prova.png') THEN
      RAISE EXCEPTION 'storage: lo studente S1 carica file nel bucket pubblico %', r.id;
    END IF;
  END LOOP;

  -- Caricamenti in student-web-assets
  IF NOT pg_temp.can_upload(s1, 'aal1', b, f1) THEN RAISE EXCEPTION 'storage: S1 non carica nella propria cartella'; END IF;
  IF NOT pg_temp.can_upload(s2, 'aal1', b, f2) THEN RAISE EXCEPTION 'storage: S2 non carica nella propria cartella'; END IF;
  IF NOT pg_temp.can_upload(s3, 'aal1', b, f3) THEN RAISE EXCEPTION 'storage: S3 non carica nella propria cartella'; END IF;
  IF pg_temp.can_upload(s1, 'aal1', b, s2 || '/intruso.png') THEN RAISE EXCEPTION 'storage: S1 carica nella cartella di S2'; END IF;
  IF pg_temp.can_upload(s1, 'aal1', b, 'intruso.png') THEN RAISE EXCEPTION 'storage: S1 carica fuori dalle cartelle'; END IF;
  IF pg_temp.can_upload(t1, 'aal2', b, s1 || '/dal-prof.png') THEN RAISE EXCEPTION 'storage: T1 carica nella cartella di S1'; END IF;
  IF pg_temp.can_upload(NULL, NULL, b, s1 || '/anonimo.png') THEN RAISE EXCEPTION 'storage: un anonimo carica file'; END IF;
  -- L'insegnante prova il compilatore web con i propri file (2FA obbligatoria)
  IF NOT pg_temp.can_upload(t1, 'aal2', b, t1 || '/prova-1.png') THEN RAISE EXCEPTION 'storage: T1 non carica nella propria cartella'; END IF;
  IF pg_temp.can_upload(t1, 'aal1', b, t1 || '/prova-2.png') THEN RAISE EXCEPTION 'storage: T1 carica senza verifica in due passaggi'; END IF;

  -- Un file con una cartella non uuid (caricato dall'admin): le policy non vanno in errore
  INSERT INTO storage.objects (bucket_id, name) VALUES (b, 'non-uuid/x.png');

  -- Chi vede cosa
  seen := pg_temp.visible(s1, 'aal1', b);
  IF seen <> ARRAY[f1] THEN RAISE EXCEPTION 'storage: S1 vede %', seen; END IF;
  seen := pg_temp.visible(s4, 'aal1', b);
  IF seen <> '{}' THEN RAISE EXCEPTION 'storage: S4 vede %', seen; END IF;
  -- T1: gruppo G1 con S1 e S3; T2: gruppo G2 con S2, S3, S4
  seen := pg_temp.visible(t1, 'aal2', b);
  IF seen <> ARRAY[f1, f3, t1 || '/prova-1.png'] THEN RAISE EXCEPTION 'storage: T1 vede %', seen; END IF;
  seen := pg_temp.visible(t2, 'aal2', b);
  IF seen <> ARRAY[f2, f3] THEN RAISE EXCEPTION 'storage: T2 vede %', seen; END IF;
  seen := pg_temp.visible(t2, 'aal1', b);
  IF seen <> '{}' THEN RAISE EXCEPTION 'storage: T2 vede file senza verifica in due passaggi: %', seen; END IF;
  -- P1: figli S1, S2; P2: figlio S3
  seen := pg_temp.visible(p1, 'aal1', b);
  IF seen <> ARRAY[f1, f2] THEN RAISE EXCEPTION 'storage: P1 vede %', seen; END IF;
  seen := pg_temp.visible(p2, 'aal1', b);
  IF seen <> ARRAY[f3] THEN RAISE EXCEPTION 'storage: P2 vede %', seen; END IF;
  seen := pg_temp.visible(adm, 'aal2', b);
  IF cardinality(seen) <> 5 THEN RAISE EXCEPTION 'storage: l''admin vede %', seen; END IF;
  seen := pg_temp.visible(NULL, NULL, b);
  IF seen <> '{}' THEN RAISE EXCEPTION 'storage: un anonimo vede %', seen; END IF;

  -- Cancellazioni
  IF pg_temp.deleted(s1, 'aal1', b, f2) <> 0 THEN RAISE EXCEPTION 'storage: S1 cancella il file di S2'; END IF;
  IF pg_temp.deleted(t2, 'aal2', b, f2) <> 0 THEN RAISE EXCEPTION 'storage: T2 cancella il file di S2'; END IF;
  IF pg_temp.deleted(p1, 'aal1', b, f2) <> 0 THEN RAISE EXCEPTION 'storage: P1 cancella il file di S2'; END IF;
  IF pg_temp.deleted(s1, 'aal1', b, f1) <> 1 THEN RAISE EXCEPTION 'storage: S1 non cancella il proprio file'; END IF;

  -- I vecchi file restano spostabili dall'admin (stesso percorso, bucket privato)
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('web-compiler-assets', s2 || '/vecchio-1.png', s2);
  PERFORM pg_temp.login(adm, 'aal2');
  SET LOCAL ROLE authenticated;
  UPDATE storage.objects SET bucket_id = b WHERE bucket_id = 'web-compiler-assets' AND name = s2 || '/vecchio-1.png';
  RESET ROLE;
  PERFORM pg_temp.logout();
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = b AND name = s2 || '/vecchio-1.png') THEN
    RAISE EXCEPTION 'storage: l''admin non sposta i vecchi file nel bucket privato';
  END IF;

  RAISE NOTICE 'File degli studenti: bucket privati e permessi verificati';
END $$;

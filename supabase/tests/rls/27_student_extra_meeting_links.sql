-- Secondo link per entrare a lezione (drizzle/migrations/0085_student_extra_meeting_links.sql).
--   - lo vedono lo studente, i suoi genitori e l'admin; non gli altri studenti né gli insegnanti;
--   - lo scrive solo l'admin con 2FA; studenti e genitori non possono cambiarlo;
--   - solo link https e un testo per il pulsante.
-- Mondo di 01_seed.sql: P1 genitore di S1 e S2, P2 genitore di S3; S2 e S3 hanno già un link.

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
  SELECT count(*) INTO n FROM public.student_extra_meeting_links;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN n;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  p2 constant uuid := '00000000-0000-0000-0000-000000000202';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  err text;
BEGIN
  -- L'admin con 2FA lo crea e lo modifica
  err := pg_temp.run_as(adm, 'aal2', format(
    'INSERT INTO public.student_extra_meeting_links (student_id, label, url) VALUES (%L, %L, %L)',
    s1, 'LINK PER GRUPPO DEL MARTEDÌ', 'https://meet.google.com/abc-defg-hij'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'extra_link: l''admin non lo crea: %', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', format(
    'UPDATE public.student_extra_meeting_links SET url = %L WHERE student_id = %L', 'https://meet.google.com/xyz', s1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'extra_link: l''admin non lo modifica: %', err; END IF;

  -- Senza 2FA l'admin no
  IF pg_temp.run_as(adm, 'aal1', format(
       'DELETE FROM public.student_extra_meeting_links WHERE student_id = %L', s2)) IS NULL THEN
    RAISE EXCEPTION 'extra_link: admin senza 2FA scrive il link';
  END IF;

  -- Chi lo vede: ognuno il proprio, il genitore quelli dei figli, l'admin tutti
  IF pg_temp.count_as(s1, 'aal1') <> 1 OR pg_temp.count_as(s2, 'aal1') <> 1 OR pg_temp.count_as(s3, 'aal1') <> 1
     OR pg_temp.count_as(p1, 'aal1') <> 2 OR pg_temp.count_as(p2, 'aal1') <> 1 OR pg_temp.count_as(adm, 'aal2') <> 3 THEN
    RAISE EXCEPTION 'extra_link: lo studente, il genitore o l''admin non vedono i link giusti';
  END IF;
  IF pg_temp.count_as(t1, 'aal2') <> 0 THEN
    RAISE EXCEPTION 'extra_link: visibile agli insegnanti';
  END IF;

  -- Studente e genitore non lo cambiano
  IF pg_temp.run_as(s1, 'aal1', format(
       'UPDATE public.student_extra_meeting_links SET url = %L WHERE student_id = %L', 'https://evil.test', s1)) IS NULL
     OR pg_temp.run_as(p1, 'aal1', format(
       'DELETE FROM public.student_extra_meeting_links WHERE student_id = %L', s1)) IS NULL
     OR pg_temp.run_as(s2, 'aal1', format(
       'UPDATE public.student_extra_meeting_links SET label = %L WHERE student_id = %L', 'X', s2)) IS NULL THEN
    RAISE EXCEPTION 'extra_link: studente o genitore modificano il link';
  END IF;
  IF (SELECT url FROM public.student_extra_meeting_links WHERE student_id = s1) <> 'https://meet.google.com/xyz' THEN
    RAISE EXCEPTION 'extra_link: link cambiato da una chiamata rifiutata';
  END IF;

  -- Solo https e testo non vuoto
  IF pg_temp.run_as(adm, 'aal2', format(
       'UPDATE public.student_extra_meeting_links SET url = %L WHERE student_id = %L', 'javascript:alert(1)', s1)) IS NULL
     OR pg_temp.run_as(adm, 'aal2', format(
       'UPDATE public.student_extra_meeting_links SET label = %L WHERE student_id = %L', '   ', s1)) IS NULL THEN
    RAISE EXCEPTION 'extra_link: accettati un link non https o un testo vuoto';
  END IF;

  -- Togliere il link cancella la riga
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.student_extra_meeting_links WHERE student_id = %L', s1));
  IF err IS NOT NULL OR pg_temp.count_as(s1, 'aal1') <> 0 OR pg_temp.count_as(s2, 'aal1') <> 1 THEN
    RAISE EXCEPTION 'extra_link: l''admin non lo toglie: %', err;
  END IF;

  RAISE NOTICE 'Secondo link: visibile a studente, genitori e admin; lo scrive solo l''admin con 2FA';
END $$;

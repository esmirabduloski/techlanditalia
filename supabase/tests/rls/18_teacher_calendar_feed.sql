-- Verifica del link segreto del calendario lezioni (drizzle/migrations/0067_teacher_calendar_feed.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama la RPC come i vari utenti:
--   - l'insegnante con 2FA ottiene il suo link, sempre lo stesso finché non lo rigenera;
--   - rigenerandolo, quello vecchio smette di esistere;
--   - senza 2FA, genitori, admin senza ruolo insegnante e anonimi non ottengono nulla;
--   - la tabella dei token non si legge né si scrive dal client.
-- Dati di partenza (01_seed.sql): T1 e T2 insegnanti con 2FA, P1 genitore, ADM admin.

CREATE FUNCTION pg_temp.as_user(_uid uuid, _aal text, _sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql INTO result;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN result;
END $$;

-- Errore della chiamata: NULL se è riuscita
CREATE FUNCTION pg_temp.error_as(_uid uuid, _aal text, _sql text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(_uid, _aal, _sql);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN SQLERRM;
END $$;

CREATE FUNCTION pg_temp.feed_token(_uid uuid, _rotate boolean)
RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_user(_uid, 'aal2', format('SELECT token FROM public.teacher_calendar_feed(%L)', _rotate))
$$;

DO $$
DECLARE
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  first_token text;
  tok text;
  err text;
BEGIN
  DELETE FROM public.teacher_calendar_feeds;

  -- T1 ottiene il suo link: 48 caratteri esadecimali, sempre lo stesso
  first_token := pg_temp.feed_token(t1, false);
  IF first_token IS NULL OR first_token !~ '^[0-9a-f]{48}$' THEN
    RAISE EXCEPTION 'calendar: token di T1 non valido: %', first_token;
  END IF;
  IF pg_temp.feed_token(t1, false) IS DISTINCT FROM first_token THEN
    RAISE EXCEPTION 'calendar: senza rigenerarlo il link di T1 è cambiato';
  END IF;

  -- T2 ha un link suo
  tok := pg_temp.feed_token(t2, false);
  IF tok IS NULL OR tok = first_token THEN
    RAISE EXCEPTION 'calendar: T2 non ha un link suo (%)', tok;
  END IF;

  -- Rigenerando, il vecchio link non esiste più
  tok := pg_temp.feed_token(t1, true);
  IF tok IS NULL OR tok = first_token THEN
    RAISE EXCEPTION 'calendar: la rigenerazione non ha cambiato il link di T1';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teacher_calendar_feeds f WHERE f.token = first_token) THEN
    RAISE EXCEPTION 'calendar: il vecchio link di T1 funziona ancora';
  END IF;
  IF (SELECT count(*) FROM public.teacher_calendar_feeds) <> 2 THEN
    RAISE EXCEPTION 'calendar: righe inattese in teacher_calendar_feeds';
  END IF;

  -- Senza 2FA, o senza essere insegnante, niente link
  err := pg_temp.error_as(t1, 'aal1', 'SELECT token FROM public.teacher_calendar_feed()');
  IF err IS NULL THEN RAISE EXCEPTION 'calendar: T1 ha ottenuto il link senza 2FA'; END IF;
  err := pg_temp.error_as(p1, 'aal1', 'SELECT token FROM public.teacher_calendar_feed()');
  IF err IS NULL OR err NOT LIKE 'Accesso negato%' THEN
    RAISE EXCEPTION 'calendar: il genitore P1 ha ottenuto un link (%)', err;
  END IF;
  err := pg_temp.error_as(adm, 'aal2', 'SELECT token FROM public.teacher_calendar_feed()');
  IF err IS NULL THEN RAISE EXCEPTION 'calendar: l''admin senza ruolo insegnante ha ottenuto un link'; END IF;
  IF has_function_privilege('anon', 'public.teacher_calendar_feed(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'calendar: gli anonimi possono chiedere un link';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teacher_calendar_feeds WHERE teacher_id IN (p1, adm)) THEN
    RAISE EXCEPTION 'calendar: creato un link per chi non è insegnante';
  END IF;

  -- La tabella dal client non si legge né si scrive, nemmeno la propria riga
  err := pg_temp.error_as(t1, 'aal2', 'SELECT count(*)::text FROM public.teacher_calendar_feeds');
  IF err IS NULL THEN RAISE EXCEPTION 'calendar: l''insegnante legge teacher_calendar_feeds'; END IF;
  err := pg_temp.error_as(t1, 'aal2', format(
    'UPDATE public.teacher_calendar_feeds SET token = %L WHERE teacher_id = %L', repeat('a', 48), t1));
  IF err IS NULL THEN RAISE EXCEPTION 'calendar: l''insegnante sceglie il proprio token'; END IF;

  RAISE NOTICE 'Calendario lezioni insegnante: link segreto ok';
END $$;

-- Verifica del collegamento a Google Calendar (drizzle/migrations/0068_google_calendar_sync.sql).
-- Gira come supabase_admin sul database usa-e-getta:
--   - cambiare lezioni, gruppi o corsi segna da risincronizzare solo gli
--     insegnanti coinvolti (vecchio e nuovo se il gruppo cambia insegnante);
--   - i cambi che non finiscono nel calendario (link registrazione) no;
--   - le connessioni ferme (accesso revocato) non vengono toccate;
--   - claim_google_calendar_syncs() prenota le connessioni: un secondo giro
--     subito dopo non le riprende;
--   - token e richieste OAuth non si leggono dal client, e il client non può
--     chiamare le funzioni interne.
-- Dati di partenza (01_seed.sql): G1 di T1 (corso C1), G2 di T2 (corso C2),
-- entrambi collegati e allineati.

CREATE FUNCTION pg_temp.error_as(_uid uuid, _sql text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql;
  RESET ROLE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLERRM;
END $$;

-- Quali insegnanti sono segnati da risincronizzare, in ordine
CREATE FUNCTION pg_temp.dirty() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(teacher_id::text, 3), ',' ORDER BY teacher_id), '-')
  FROM public.google_calendar_connections WHERE dirty_at IS NOT NULL
$$;

CREATE FUNCTION pg_temp.reset() RETURNS void LANGUAGE sql AS $$
  UPDATE public.google_calendar_connections
  SET dirty_at = NULL, retry_after = NULL, status = 'active', last_synced_at = now();
$$;

DO $$
DECLARE
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  t2 constant uuid := '00000000-0000-0000-0000-000000000302';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  lesson uuid;
  err text;
  n int;
BEGIN
  PERFORM pg_temp.reset();
  SELECT id INTO lesson FROM public.group_lesson_schedule WHERE group_id = g1 ORDER BY lesson_number LIMIT 1;
  IF lesson IS NULL THEN RAISE EXCEPTION 'google: G1 senza lezioni nel calendario di prova'; END IF;

  -- Spostare una lezione di G1 segna solo T1
  UPDATE public.group_lesson_schedule SET lesson_time = '18:30' WHERE id = lesson;
  IF pg_temp.dirty() <> '301' THEN RAISE EXCEPTION 'google: spostando una lezione di G1 segnati %', pg_temp.dirty(); END IF;

  -- Il link della registrazione non finisce nel calendario
  PERFORM pg_temp.reset();
  UPDATE public.group_lesson_schedule SET recording_url = 'https://rec.test' WHERE id = lesson;
  UPDATE public.group_lesson_schedule SET lesson_time = '18:30' WHERE id = lesson;
  IF pg_temp.dirty() <> '-' THEN RAISE EXCEPTION 'google: cambi senza effetto sul calendario segnano %', pg_temp.dirty(); END IF;

  -- Lezione aggiunta e tolta
  INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES (g1, 999, current_date + 400);
  IF pg_temp.dirty() <> '301' THEN RAISE EXCEPTION 'google: lezione aggiunta a G1 segna %', pg_temp.dirty(); END IF;
  PERFORM pg_temp.reset();
  DELETE FROM public.group_lesson_schedule WHERE group_id = g1 AND lesson_number = 999;
  IF pg_temp.dirty() <> '301' THEN RAISE EXCEPTION 'google: lezione tolta da G1 segna %', pg_temp.dirty(); END IF;

  -- Il gruppo passa a T2: tutti e due; e torna a T1
  PERFORM pg_temp.reset();
  UPDATE public.student_groups SET teacher_id = t2 WHERE id = g1;
  IF pg_temp.dirty() <> '301,302' THEN RAISE EXCEPTION 'google: cambio insegnante di G1 segna %', pg_temp.dirty(); END IF;
  UPDATE public.student_groups SET teacher_id = t1 WHERE id = g1;

  -- Link dell'aula del gruppo
  PERFORM pg_temp.reset();
  UPDATE public.student_groups SET teacher_meeting_link = 'https://t1-nuovo.test' WHERE id = g1;
  IF pg_temp.dirty() <> '301' THEN RAISE EXCEPTION 'google: nuovo link aula di G1 segna %', pg_temp.dirty(); END IF;

  -- Nome del corso C1 (di G1)
  PERFORM pg_temp.reset();
  UPDATE public.courses SET title = title || ' (nuovo)' WHERE id = c1;
  IF pg_temp.dirty() <> '301' THEN RAISE EXCEPTION 'google: rinomina del corso C1 segna %', pg_temp.dirty(); END IF;

  -- Una connessione revocata resta ferma
  PERFORM pg_temp.reset();
  UPDATE public.google_calendar_connections SET status = 'revoked' WHERE teacher_id = t1;
  UPDATE public.group_lesson_schedule SET lesson_time = '19:00' WHERE id = lesson;
  IF pg_temp.dirty() <> '-' THEN RAISE EXCEPTION 'google: segnata una connessione revocata (%)', pg_temp.dirty(); END IF;

  -- Prenotazione: prende solo ciò che è da fare, e una volta sola
  PERFORM pg_temp.reset();
  UPDATE public.google_calendar_connections SET dirty_at = now() WHERE teacher_id = t1;
  SELECT count(*) INTO n FROM public.claim_google_calendar_syncs(20);
  IF n <> 1 THEN RAISE EXCEPTION 'google: prenotate % connessioni invece di 1', n; END IF;
  SELECT count(*) INTO n FROM public.claim_google_calendar_syncs(20);
  IF n <> 0 THEN RAISE EXCEPTION 'google: la stessa connessione prenotata due volte'; END IF;
  -- Non allineata da più di un giorno: si riprende anche senza modifiche
  PERFORM pg_temp.reset();
  UPDATE public.google_calendar_connections SET last_synced_at = now() - interval '2 days' WHERE teacher_id = t2;
  SELECT count(*) INTO n FROM public.claim_google_calendar_syncs(20) c WHERE c.teacher_id = t2;
  IF n <> 1 THEN RAISE EXCEPTION 'google: connessione ferma da 2 giorni non ripresa'; END IF;

  -- Dal client niente: né le tabelle né le funzioni interne
  err := pg_temp.error_as(t1, 'SELECT count(*) FROM public.google_calendar_connections');
  IF err IS NULL THEN RAISE EXCEPTION 'google: l''insegnante legge google_calendar_connections'; END IF;
  err := pg_temp.error_as(t1, 'SELECT count(*) FROM public.google_oauth_states');
  IF err IS NULL THEN RAISE EXCEPTION 'google: l''insegnante legge google_oauth_states'; END IF;
  err := pg_temp.error_as(t1, format('SELECT public.google_calendar_touch(ARRAY[%L]::uuid[])', t2));
  IF err IS NULL THEN RAISE EXCEPTION 'google: il client chiama google_calendar_touch'; END IF;
  err := pg_temp.error_as(t1, 'SELECT count(*) FROM public.claim_google_calendar_syncs(20)');
  IF err IS NULL THEN RAISE EXCEPTION 'google: il client chiama claim_google_calendar_syncs'; END IF;
  err := pg_temp.error_as(t1, 'SELECT public.cleanup_google_oauth_states()');
  IF err IS NULL THEN RAISE EXCEPTION 'google: il client chiama cleanup_google_oauth_states'; END IF;

  PERFORM pg_temp.reset();
  RAISE NOTICE 'Google Calendar: trigger, prenotazioni e accessi ok';
END $$;

-- Verifica del consenso agli strumenti AI (drizzle/migrations/0054_ai_parental_consent.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama le RPC come i vari utenti:
--   - sotto i 14 anni (o senza anno di nascita) decide il genitore; dai 14 anche lo studente;
--   - lo studente può sempre revocare per sé, ma non cambiarsi l'anno di nascita;
--   - il genitore decide solo per i propri figli; l'admin (con 2FA) può solo revocare;
--   - si concede solo sulla versione in vigore; con una versione nuova i consensi vanno rinnovati;
--   - correggere l'anno sotto i 14 fa decadere il consenso dato dallo studente;
--   - ai_access_allowed e ai_self_consent_age non sono chiamabili dagli utenti.
-- Dati di partenza (01_seed.sql): versione test-ai-1; S1 con 15 anni, S2 con 10,
-- S3 senza anno; consenso attivo per S1 (dato da lui) e S3 (dal genitore P2).

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

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s3 constant uuid := '00000000-0000-0000-0000-000000000103';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  p2 constant uuid := '00000000-0000-0000-0000-000000000202';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  this_year constant int := extract(year FROM (now() AT TIME ZONE 'Europe/Rome'))::int;
  err text;
  r record;
  n int;
BEGIN
  -- Stato visto dagli utenti e dalle edge function
  IF pg_temp.as_user(s1, 'aal1', $q$SELECT public.my_ai_access()->>'status'$q$) IS DISTINCT FROM 'granted' THEN
    RAISE EXCEPTION 'ai: S1 doveva avere gli strumenti AI attivi';
  END IF;
  IF pg_temp.as_user(s1, 'aal1', $q$SELECT public.my_ai_access()->>'can_self_consent'$q$) IS DISTINCT FROM 'true'
     OR pg_temp.as_user(s2, 'aal1', $q$SELECT public.my_ai_access()->>'can_self_consent'$q$) IS DISTINCT FROM 'false'
     OR pg_temp.as_user(s3, 'aal1', $q$SELECT public.my_ai_access()->>'can_self_consent'$q$) IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'ai: età per decidere da soli sbagliata (S1 15 anni sì, S2 10 anni no, S3 senza anno no)';
  END IF;
  IF pg_temp.as_user(p1, 'aal1', $q$SELECT public.my_ai_access()->>'status'$q$) IS DISTINCT FROM 'adult'
     OR pg_temp.as_user(p1, 'aal1', $q$SELECT public.my_ai_access()->>'allowed'$q$) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'ai: un genitore non ha bisogno del consenso';
  END IF;
  IF NOT public.ai_access_allowed(s1) OR public.ai_access_allowed(s2) THEN
    RAISE EXCEPTION 'ai: ai_access_allowed doveva permettere S1 e non S2';
  END IF;

  -- Sotto i 14 anni o senza anno lo studente non si attiva da solo...
  err := pg_temp.error_as(s2, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s2, 'test-ai-1'));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: S2 (10 anni) si è attivato gli strumenti AI da solo'; END IF;
  err := pg_temp.error_as(s3, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-1'));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: S3 (senza anno di nascita) si è attivato gli strumenti AI da solo'; END IF;
  -- ...ma può sempre disattivarli
  err := pg_temp.error_as(s3, 'aal1', format('SELECT public.set_ai_consent(%L, false, NULL)', s3));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: S3 non ha potuto disattivare gli strumenti AI (%)', err; END IF;
  SELECT * INTO r FROM public.ai_consents WHERE student_id = s3;
  IF r.granted OR r.decided_as <> 'student' OR r.decided_by <> s3 THEN
    RAISE EXCEPTION 'ai: revoca di S3 registrata male (%)', row_to_json(r);
  END IF;

  -- Lo studente non si cambia l'anno di nascita
  err := pg_temp.error_as(s2, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s2, this_year - 15));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: S2 si è cambiato l''anno di nascita'; END IF;

  -- Il genitore decide solo per i propri figli
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-1'));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: P1 ha dato il consenso per S3, che non è suo figlio'; END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s3, this_year - 10));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: P1 ha indicato l''anno di nascita di S3'; END IF;

  -- Si concede solo sulla versione in vigore
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s2, 'vecchia'));
  IF err IS NULL OR err NOT LIKE 'L''informativa è cambiata%' THEN
    RAISE EXCEPTION 'ai: consenso dato su una versione non in vigore (%)', err;
  END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s2, 'test-ai-1'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: P1 non ha potuto dare il consenso per S2 (%)', err; END IF;
  SELECT * INTO r FROM public.ai_consents WHERE student_id = s2;
  IF NOT r.granted OR r.decided_as <> 'parent' OR r.decided_by <> p1 OR r.version <> 'test-ai-1' THEN
    RAISE EXCEPTION 'ai: consenso di P1 per S2 registrato male (%)', row_to_json(r);
  END IF;

  -- Anni di nascita fuori dai 4-19 anni
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s2, this_year - 30));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: accettato un anno di nascita di 30 anni fa'; END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s2, this_year - 2));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: accettato un anno di nascita di 2 anni fa'; END IF;

  -- Dai 14 anni lo studente decide da solo, in entrambe le direzioni
  err := pg_temp.error_as(s1, 'aal1', format('SELECT public.set_ai_consent(%L, false, NULL)', s1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: S1 non ha potuto disattivare (%)', err; END IF;
  err := pg_temp.error_as(s1, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s1, 'test-ai-1'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: S1 (15 anni) non ha potuto attivarsi gli strumenti AI (%)', err; END IF;

  -- Se il genitore corregge l'anno sotto i 14, il consenso dato da S1 decade...
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s1, this_year - 12));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: P1 non ha potuto correggere l''anno di S1 (%)', err; END IF;
  SELECT * INTO r FROM public.ai_consents WHERE student_id = s1;
  IF r.granted OR r.decided_as <> 'parent' THEN
    RAISE EXCEPTION 'ai: il consenso dato da S1 sotto i 14 anni è rimasto valido (%)', row_to_json(r);
  END IF;
  -- ...ma non quello dato dal genitore
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s2, this_year - 11));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: P1 non ha potuto correggere l''anno di S2 (%)', err; END IF;
  IF NOT (SELECT granted FROM public.ai_consents WHERE student_id = s2) THEN
    RAISE EXCEPTION 'ai: correggere l''anno ha tolto il consenso dato dal genitore';
  END IF;

  -- L'admin può solo revocare, e solo con la 2FA
  err := pg_temp.error_as(adm, 'aal2', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-1'));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: l''admin ha dato il consenso al posto del genitore'; END IF;
  err := pg_temp.error_as(adm, 'aal1', format('SELECT public.set_ai_consent(%L, false, NULL)', s2));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: l''admin ha revocato senza la verifica in due passaggi'; END IF;
  err := pg_temp.error_as(adm, 'aal2', format('SELECT public.set_ai_consent(%L, false, NULL)', s2));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: l''admin non ha potuto registrare la revoca (%)', err; END IF;
  IF (SELECT decided_as FROM public.ai_consents WHERE student_id = s2) <> 'admin' THEN
    RAISE EXCEPTION 'ai: revoca dell''admin registrata male';
  END IF;

  -- Lo storico tiene ogni decisione: per S2 il consenso di P1 e la revoca dell'admin
  SELECT count(*) INTO n FROM public.ai_consent_events WHERE student_id = s2;
  IF n <> 2 THEN RAISE EXCEPTION 'ai: storico di S2 con % righe invece di 2', n; END IF;

  -- Le funzioni interne non sono per gli utenti
  err := pg_temp.error_as(s1, 'aal1', format('SELECT public.ai_access_allowed(%L)::text', s1));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: uno studente ha chiamato ai_access_allowed'; END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.ai_self_consent_age(%L)::text', s1));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: un genitore ha chiamato ai_self_consent_age'; END IF;

  -- Con una versione nuova dell'informativa il consenso va rinnovato
  err := pg_temp.error_as(p2, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-1'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'ai: P2 non ha potuto riattivare per S3 (%)', err; END IF;
  IF NOT public.ai_access_allowed(s3) THEN RAISE EXCEPTION 'ai: S3 doveva avere accesso'; END IF;
  INSERT INTO public.ai_consent_versions (version, published_at) VALUES ('test-ai-2', current_date + 1);
  IF public.ai_access_allowed(s3) THEN
    RAISE EXCEPTION 'ai: un consenso sulla versione vecchia vale ancora';
  END IF;
  IF pg_temp.as_user(s3, 'aal1', $q$SELECT public.my_ai_access()->>'status'$q$) IS DISTINCT FROM 'outdated' THEN
    RAISE EXCEPTION 'ai: S3 doveva vedere il consenso da rinnovare';
  END IF;
  err := pg_temp.error_as(p2, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-1'));
  IF err IS NULL THEN RAISE EXCEPTION 'ai: rinnovato il consenso sulla versione vecchia'; END IF;
  err := pg_temp.error_as(p2, 'aal1', format('SELECT public.set_ai_consent(%L, true, %L)', s3, 'test-ai-2'));
  IF err IS NOT NULL OR NOT public.ai_access_allowed(s3) THEN
    RAISE EXCEPTION 'ai: P2 non ha potuto rinnovare il consenso (%)', err;
  END IF;

  -- Gli utenti anonimi non chiamano le RPC
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.set_ai_consent(s1, true, 'test-ai-2');
    RAISE EXCEPTION 'ai: un utente anonimo ha chiamato set_ai_consent';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  RAISE NOTICE 'Consenso agli strumenti AI: tutti i controlli superati';
END $$;

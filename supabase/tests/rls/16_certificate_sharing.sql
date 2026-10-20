-- Verifica degli attestati verificabili e condivisibili (drizzle/migrations/0064_certificate_sharing.sql).
-- Gira come supabase_admin sul database usa-e-getta e chiama le RPC come i vari utenti:
--   - chiunque, anche senza account, verifica un attestato dal codice: se è
--     privato vede solo iniziali, corso e data;
--   - pubblico: anche nome, insegnante e competenze;
--   - rende pubblico il genitore (solo dei propri figli) o lo studente con 14
--     anni certi; insegnanti e admin no; tornare privato anche l'admin;
--   - la famiglia non può scrivere la tabella direttamente;
--   - correggere l'anno di nascita sotto i 14 fa decadere la pubblicazione
--     decisa dallo studente, non quella del genitore.
-- Dati di partenza (01_seed.sql e 10_course_certificates.sql): S1 (figlio di P1)
-- ha TL-TEST-S1G1, S3 (figlio di P2) ha TL-TEST-S3G2, S2 (figlio di P1) ha un
-- attestato in G2.

CREATE FUNCTION pg_temp.as_user(_uid uuid, _aal text, _sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
  IF _uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
    PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
    SET LOCAL ROLE authenticated;
  END IF;
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

-- Quello che vede chi apre il link: la riga di verify_certificate() in JSON
CREATE FUNCTION pg_temp.verify_as(_uid uuid, _code text)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.as_user(_uid, 'aal1',
    format('SELECT to_jsonb(v)::text FROM public.verify_certificate(%L) v', _code))::jsonb
$$;

CREATE FUNCTION pg_temp.share_as(_uid uuid, _aal text, _cert uuid, _public boolean)
RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.error_as(_uid, _aal, format('SELECT public.set_certificate_public(%L, %L)::text', _cert, _public))
$$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  p2 constant uuid := '00000000-0000-0000-0000-000000000202';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  g2 constant uuid := '00000000-0000-0000-0000-00000000a002';
  this_year constant int := extract(year FROM (now() AT TIME ZONE 'Europe/Rome'))::int;
  cert_s1 uuid;
  cert_s2 uuid;
  cert_s3 uuid;
  v jsonb;
  err text;
  r record;
BEGIN
  -- S1 con 15 anni, S2 con 10 (altri file possono averli cambiati); tutto privato
  UPDATE public.student_birth_years SET birth_year = this_year - 15 WHERE student_id = s1;
  UPDATE public.student_birth_years SET birth_year = this_year - 10 WHERE student_id = s2;
  UPDATE public.course_certificates SET shared_at = NULL, shared_by = NULL, shared_as = NULL;
  SELECT id INTO cert_s1 FROM public.course_certificates WHERE code = 'TL-TEST-S1G1';
  SELECT id INTO cert_s3 FROM public.course_certificates WHERE code = 'TL-TEST-S3G2';
  SELECT id INTO cert_s2 FROM public.course_certificates WHERE student_id = s2 AND group_id = g2;
  IF cert_s1 IS NULL OR cert_s2 IS NULL OR cert_s3 IS NULL THEN
    RAISE EXCEPTION 'sharing: attestati di partenza mancanti (S1 %, S2 %, S3 %)', cert_s1, cert_s2, cert_s3;
  END IF;

  -- Senza account: attestato privato, solo iniziali, corso e data
  v := pg_temp.verify_as(NULL, 'TL-TEST-S1G1');
  IF v IS NULL OR v->>'code' <> 'TL-TEST-S1G1' OR (v->>'is_public')::boolean OR v->>'student_name' <> 'A. S.'
     OR v->>'course_title' <> 'Corso C1' OR v->>'issued_on' IS NULL
     OR v->>'teacher_name' IS NOT NULL OR v->'hard_skills' <> '[]'::jsonb OR v->'soft_skills' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'sharing: verifica anonima di un attestato privato sbagliata: %', v;
  END IF;
  -- Il codice scritto a mano: minuscole e spazi vanno bene
  IF pg_temp.verify_as(NULL, '  tl-test-s1g1 ')->>'code' IS DISTINCT FROM 'TL-TEST-S1G1' THEN
    RAISE EXCEPTION 'sharing: il codice in minuscolo non viene riconosciuto';
  END IF;
  IF pg_temp.verify_as(NULL, 'TL-TEST-NOPE') IS NOT NULL THEN
    RAISE EXCEPTION 'sharing: un codice inesistente risulta valido';
  END IF;
  -- Gli anonimi non leggono la tabella e non cambiano nulla
  IF pg_temp.as_user(NULL, 'aal1', 'SELECT count(*)::text FROM public.course_certificates') IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'sharing: gli anonimi leggono course_certificates';
  END IF;
  IF has_function_privilege('anon', 'public.set_certificate_public(uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sharing: gli anonimi possono rendere pubblico un attestato';
  END IF;

  -- S2 ha 10 anni: per renderlo pubblico serve il genitore
  err := pg_temp.share_as(s2, 'aal1', cert_s2, true);
  IF err IS NULL OR err NOT LIKE 'Sotto i 14 anni%' THEN
    RAISE EXCEPTION 'sharing: S2 (10 anni) ha reso pubblico il proprio attestato (%)', err;
  END IF;
  -- Né S1 né il genitore P1 toccano l'attestato di S3; l'insegnante nemmeno
  IF pg_temp.share_as(s1, 'aal1', cert_s3, true) IS NULL THEN
    RAISE EXCEPTION 'sharing: S1 ha reso pubblico l''attestato di S3';
  END IF;
  IF pg_temp.share_as(p1, 'aal1', cert_s3, true) IS NULL THEN
    RAISE EXCEPTION 'sharing: P1 ha reso pubblico l''attestato di un figlio di P2';
  END IF;
  IF pg_temp.share_as(t1, 'aal2', cert_s1, true) IS NULL THEN
    RAISE EXCEPTION 'sharing: l''insegnante T1 ha reso pubblico un attestato';
  END IF;
  IF pg_temp.share_as(adm, 'aal2', cert_s1, true) IS NULL THEN
    RAISE EXCEPTION 'sharing: l''admin ha reso pubblico un attestato';
  END IF;
  -- Scrivere la tabella direttamente non serve a niente
  PERFORM pg_temp.error_as(s1, 'aal1', format('UPDATE public.course_certificates SET shared_at = now() WHERE id = %L', cert_s1));
  PERFORM pg_temp.error_as(p1, 'aal1', format('UPDATE public.course_certificates SET shared_at = now() WHERE id = %L', cert_s2));
  IF EXISTS (SELECT 1 FROM public.course_certificates WHERE shared_at IS NOT NULL) THEN
    RAISE EXCEPTION 'sharing: la famiglia ha cambiato course_certificates senza la RPC';
  END IF;

  -- S1 ha 15 anni: lo rende pubblico da solo; chi apre il link vede tutto
  err := pg_temp.share_as(s1, 'aal1', cert_s1, true);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: S1 (15 anni) non riesce a renderlo pubblico: %', err; END IF;
  SELECT * INTO r FROM public.course_certificates WHERE id = cert_s1;
  IF r.shared_at IS NULL OR r.shared_by <> s1 OR r.shared_as <> 'student' THEN
    RAISE EXCEPTION 'sharing: pubblicazione di S1 registrata male: %', to_jsonb(r);
  END IF;
  v := pg_temp.verify_as(NULL, 'TL-TEST-S1G1');
  IF NOT (v->>'is_public')::boolean OR v->>'student_name' <> 'Alunno S1' OR v->>'teacher_name' <> 'Insegnante T1'
     OR v->'hard_skills' <> to_jsonb(r.hard_skills) OR v->'soft_skills' <> to_jsonb(r.soft_skills) THEN
    RAISE EXCEPTION 'sharing: verifica di un attestato pubblico sbagliata: %', v;
  END IF;

  -- Il genitore P1 rende pubblico quello di S2 (10 anni)
  err := pg_temp.share_as(p1, 'aal1', cert_s2, true);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: P1 non riesce a rendere pubblico l''attestato di S2: %', err; END IF;
  SELECT * INTO r FROM public.course_certificates WHERE id = cert_s2;
  IF r.shared_by <> p1 OR r.shared_as <> 'parent' THEN
    RAISE EXCEPTION 'sharing: pubblicazione di P1 registrata male: %', to_jsonb(r);
  END IF;
  -- S2 può sempre tornare privato, anche se l'ha deciso il genitore
  err := pg_temp.share_as(s2, 'aal1', cert_s2, false);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: S2 non riesce a tornare privato: %', err; END IF;
  IF (SELECT shared_at FROM public.course_certificates WHERE id = cert_s2) IS NOT NULL THEN
    RAISE EXCEPTION 'sharing: l''attestato di S2 è rimasto pubblico';
  END IF;
  IF (pg_temp.verify_as(NULL, (SELECT code FROM public.course_certificates WHERE id = cert_s2))->>'is_public')::boolean THEN
    RAISE EXCEPTION 'sharing: la verifica mostra ancora pubblico l''attestato di S2';
  END IF;

  -- L'admin con 2FA può tornare privato, senza 2FA no
  err := pg_temp.share_as(p1, 'aal1', cert_s2, true);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: P1 non riesce a ripubblicare: %', err; END IF;
  IF pg_temp.share_as(adm, 'aal1', cert_s2, false) IS NULL THEN
    RAISE EXCEPTION 'sharing: l''admin senza 2FA ha cambiato un attestato';
  END IF;
  err := pg_temp.share_as(adm, 'aal2', cert_s2, false);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: l''admin non riesce a renderlo privato: %', err; END IF;
  IF (SELECT shared_at FROM public.course_certificates WHERE id = cert_s2) IS NOT NULL THEN
    RAISE EXCEPTION 'sharing: l''admin non ha reso privato l''attestato di S2';
  END IF;

  -- Il genitore corregge l'anno di S1 a 12 anni: la pubblicazione di S1 decade,
  -- quella decisa dal genitore resta
  err := pg_temp.share_as(p1, 'aal1', cert_s2, true);
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: P1 non riesce a ripubblicare: %', err; END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s1, this_year - 12));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: P1 non riesce a correggere l''anno di S1: %', err; END IF;
  IF (SELECT shared_at FROM public.course_certificates WHERE id = cert_s1) IS NOT NULL THEN
    RAISE EXCEPTION 'sharing: con 12 anni l''attestato reso pubblico da S1 è rimasto pubblico';
  END IF;
  err := pg_temp.error_as(p1, 'aal1', format('SELECT public.set_student_birth_year(%L, %s)', s2, this_year - 9));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'sharing: P1 non riesce a correggere l''anno di S2: %', err; END IF;
  IF (SELECT shared_at FROM public.course_certificates WHERE id = cert_s2) IS NULL THEN
    RAISE EXCEPTION 'sharing: cambiare l''anno ha tolto la pubblicazione decisa dal genitore';
  END IF;
  -- Con 12 anni S1 non può più renderlo pubblico da solo
  IF pg_temp.share_as(s1, 'aal1', cert_s1, true) IS NULL THEN
    RAISE EXCEPTION 'sharing: S1 (12 anni) ha reso pubblico il proprio attestato';
  END IF;

  -- Rimette i dati come prima
  UPDATE public.student_birth_years SET birth_year = this_year - 15 WHERE student_id = s1;
  UPDATE public.student_birth_years SET birth_year = this_year - 10 WHERE student_id = s2;
  UPDATE public.course_certificates SET shared_at = NULL, shared_by = NULL, shared_as = NULL;

  RAISE NOTICE 'Attestati condivisibili: verifica pubblica, permessi e decadenza OK';
END $$;

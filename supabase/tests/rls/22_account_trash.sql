-- Account eliminati nel cestino (drizzle/migrations/0076_account_trash.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova:
--   - il trigger 'account_only' è sui profili e sulle tabelle raggiunte solo da loro;
--   - un profilo cancellato fuori da trash_account() non entra nel cestino (come prima);
--   - il genitore che si elimina: lui e i figli in un batch, login bloccati ma
--     con ruoli e consensi, visibile solo all'admin con 2FA;
--   - trash_account solo dal service role; purge_trash_batch, empty_trash e
--     cleanup_old_logs non eliminano gli account;
--   - il ripristino rimette il database com'era e il login com'era (anche un blocco precedente);
--   - un alunno eliminato dall'admin: il genitore non cambia, ripristino identico;
--   - un batch più vecchio con i dati di un account nel cestino non torna prima dell'account;
--   - purge_account_trash: login cancellato, batch e righe con i suoi dati fuori dal cestino.
--
-- Mondo di 01_seed.sql: P1 genitore di S1 e S2, P2 genitore di S3, S4 senza genitore.

-- Come 20_trash.sql: un comando come l'utente, NULL se è riuscito, altrimenti l'errore.
CREATE FUNCTION pg_temp.run_as(_uid uuid, _aal text, _sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('techland.trash_batch', '', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('techland.trash_batch', '', true);
  RETURN CASE WHEN n = 0 THEN 'nessuna riga' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('techland.trash_batch', '', true);
  RETURN SQLERRM;
END $$;

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

-- Una SELECT come le edge function (service role): il risultato, o l'errore.
CREATE FUNCTION pg_temp.run_service(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  EXECUTE _sql INTO r;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE;
END $$;

-- Impronta di ogni tabella, come 20_trash.sql
CREATE FUNCTION pg_temp.fingerprint() RETURNS TABLE(tbl text, h text) LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'trash_items'
    ORDER BY 1
  LOOP
    tbl := r.relname;
    EXECUTE format(
      'SELECT md5(coalesce(string_agg(x, '','' ORDER BY x), '''')) '
      'FROM (SELECT (to_jsonb(t) - ''updated_at'' - ''dirty_at'')::text AS x FROM public.%I t) s', r.relname)
      INTO h;
    RETURN NEXT;
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.changed_since(_snap text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN
  EXECUTE format(
    'SELECT string_agg(a.tbl, '', '' ORDER BY a.tbl) FROM %I a JOIN pg_temp.fingerprint() b USING (tbl) '
    'WHERE a.h IS DISTINCT FROM b.h', _snap) INTO got;
  RETURN got;
END $$;

-- Trigger: 'account_only' sui profili e sulle tabelle raggiunte solo da loro
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(t, ', ') INTO got
  FROM unnest(ARRAY['profiles', 'student_streaks', 'streak_freezes', 'satisfaction_surveys',
                    'subscription_pauses', 'student_password_settings', 'email_log']) t
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgname = 'a_trash_capture'
                      AND g.tgrelid = format('public.%I', t)::regclass
                      AND encode(g.tgargs, 'escape') LIKE 'account_only%');
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'account trash: manca il trigger account_only su %', got;
  END IF;

  -- Le figlie già nel cestino dell'admin catturano sempre, come prima
  SELECT string_agg(c.relname, ', ') INTO got
  FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
  WHERE g.tgname = 'a_trash_capture' AND encode(g.tgargs, 'escape') LIKE 'account_only%'
    AND c.relname IN ('group_students', 'enrollments', 'homework_submissions', 'group_attendance', 'referrals');
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'account trash: trigger account_only su tabelle del cestino dell''admin: %', got;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO got
  FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
  WHERE g.tgname = 'a_trash_capture' AND c.relname IN ('user_roles', 'trash_items', 'account_trash');
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'account trash: trigger su tabelle che non devono passare dal cestino: %', got;
  END IF;
  RAISE NOTICE 'Account nel cestino: trigger account_only su % tabelle',
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'a_trash_capture' AND encode(tgargs, 'escape') LIKE 'account_only%');
END $$;

-- Fuori da trash_account(): il profilo si cancella col login, niente cestino
DO $$
DECLARE s7 constant uuid := '00000000-0000-0000-0000-000000000117';
BEGIN
  -- Si parte da un cestino vuoto: 01_seed.sql ha una riga finta per 02_checks.sql
  DELETE FROM public.trash_items;
  DELETE FROM public.account_trash;
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', s7, 'authenticated', 'authenticated', 's7@test.local',
          '{"full_name":"Alunno S7"}', now(), now());
  INSERT INTO public.student_streaks (student_id) VALUES (s7);
  DELETE FROM public.profiles WHERE id = s7;
  IF EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'account trash: un profilo cancellato fuori da trash_account è finito nel cestino (%)',
      (SELECT string_agg(DISTINCT table_name, ', ') FROM public.trash_items);
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = s7) THEN
    RAISE EXCEPTION 'delete_auth_user_on_profile_delete: il login non è stato cancellato col profilo';
  END IF;
  RAISE NOTICE 'Account nel cestino: profili cancellati in altro modo restano fuori, come prima';
END $$;

-- I secondi genitori di 01_seed.sql (P3 per S2 e S3) li prova 23_second_parent.sql:
-- qui P1 si elimina insieme a entrambi i figli, come prima.
DELETE FROM public.student_guardians;

-- Il genitore P1 si elimina: lui, S1 e S2 nel cestino; poi l'admin lo ripristina.
-- S2 aveva già un blocco del login (scaduto): al ripristino torna quello.
UPDATE auth.users SET banned_until = now() - interval '1 day' WHERE id = '00000000-0000-0000-0000-000000000102';
CREATE TEMP TABLE fp_family AS SELECT * FROM pg_temp.fingerprint();

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  qa constant text := 'SELECT count(*)::int FROM public.account_trash';
  b uuid;
  got text;
  err text;
BEGIN
  DELETE FROM public.trash_items;

  -- Solo le edge function (service role) mettono un account nel cestino
  IF pg_temp.run_as(p1, 'aal1', format('SELECT public.trash_account(%L, %L)', p1, p1)) IS NULL
     OR pg_temp.run_as(adm, 'aal2', format('SELECT public.trash_account(%L, %L)', s4, adm)) IS NULL THEN
    RAISE EXCEPTION 'trash_account: un utente l''ha chiamata direttamente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'trash_account: una chiamata rifiutata ha lasciato righe nel cestino';
  END IF;

  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', p1, p1))::uuid;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (p1, s1, s2)) THEN
    RAISE EXCEPTION 'trash_account: i profili di P1, S1 o S2 sono ancora lì';
  END IF;
  -- L'impronta vede la differenza (altrimenti il confronto dopo il ripristino non prova niente)
  IF coalesce(pg_temp.changed_since('fp_family'), '') NOT LIKE '%profiles%' THEN
    RAISE EXCEPTION 'fingerprint: non vede i profili cancellati';
  END IF;
  IF (SELECT count(*) FROM auth.users WHERE id IN (p1, s1, s2) AND banned_until > now() + interval '99 years') <> 3 THEN
    RAISE EXCEPTION 'trash_account: i login di P1, S1 e S2 non sono tutti bloccati';
  END IF;
  IF (SELECT count(*) FROM public.account_trash WHERE batch_id = b AND deleted_by = p1) <> 3 THEN
    RAISE EXCEPTION 'account_trash: attesi P1, S1 e S2 nel batch, eliminati da P1';
  END IF;
  IF (SELECT count(DISTINCT batch_id) FROM public.trash_items) <> 1 THEN
    RAISE EXCEPTION 'trash_account: l''account è finito in più batch';
  END IF;
  IF (SELECT root_table FROM public.trash_batches WHERE batch_id = b) <> 'profiles'
     OR (SELECT root_data->>'id' FROM public.trash_batches WHERE batch_id = b) IS DISTINCT FROM p1::text
     OR (SELECT deleted_by FROM public.trash_batches WHERE batch_id = b) IS DISTINCT FROM p1
     OR (SELECT (counts->>'profiles')::int FROM public.trash_batches WHERE batch_id = b) <> 3 THEN
    RAISE EXCEPTION 'trash_batches: riepilogo dell''account sbagliato';
  END IF;
  SELECT string_agg(t, ', ') INTO got
  FROM unnest(ARRAY['group_students', 'enrollments', 'homework_submissions', 'lesson_progress', 'task_progress',
                    'user_achievements', 'student_streaks', 'streak_freezes', 'student_password_settings',
                    'satisfaction_surveys', 'subscription_pauses', 'lesson_balance_log', 'email_log', 'referrals']) t
  WHERE NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b AND table_name = t);
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'trash_account: nel batch di P1 mancano %', got;
  END IF;

  -- Il login resta con ruoli e consensi
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = s1)
     OR NOT EXISTS (SELECT 1 FROM public.student_birth_years WHERE student_id = s1) THEN
    RAISE EXCEPTION 'trash_account: ruoli o dati del login di S1 cancellati';
  END IF;

  -- Visibilità di account_trash
  IF pg_temp.count_as(t1, 'aal2', qa) <> 0 OR pg_temp.count_as(adm, 'aal1', qa) <> 0 THEN
    RAISE EXCEPTION 'account_trash: un non-admin (o l''admin senza 2FA) vede gli account nel cestino';
  END IF;
  IF pg_temp.count_as(adm, 'aal2', qa) <> 3 THEN
    RAISE EXCEPTION 'account_trash: l''admin con 2FA non vede gli account nel cestino';
  END IF;

  -- Elimina per sempre e svuota cestino non toccano gli account
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.purge_trash_batch(%L)', b));
  IF err IS NULL OR err NOT LIKE 'trash_account%' THEN
    RAISE EXCEPTION 'purge_trash_batch: su un account atteso trash_account (%)', err;
  END IF;
  err := pg_temp.run_as(adm, 'aal2', 'SELECT public.empty_trash()');
  IF err IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b) THEN
    RAISE EXCEPTION 'empty_trash: ha svuotato anche l''account (%)', err;
  END IF;

  -- Dopo 30 giorni la pulizia notturna lo lascia a purge-deleted-accounts
  UPDATE public.trash_items SET deleted_at = deleted_at - interval '31 days' WHERE batch_id = b;
  UPDATE public.account_trash SET deleted_at = deleted_at - interval '31 days' WHERE batch_id = b;
  PERFORM public.cleanup_old_logs();
  IF NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b) THEN
    RAISE EXCEPTION 'cleanup_old_logs: ha cancellato le righe di un account nel cestino';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: l''account di P1 non torna (%)', err; END IF;
  IF EXISTS (SELECT 1 FROM public.trash_items) OR EXISTS (SELECT 1 FROM public.account_trash) THEN
    RAISE EXCEPTION 'restore_trash_batch: l''account ripristinato è rimasto nel cestino';
  END IF;
  IF (SELECT banned_until FROM auth.users WHERE id = p1) IS NOT NULL
     OR (SELECT banned_until FROM auth.users WHERE id = s1) IS NOT NULL
     OR (SELECT banned_until FROM auth.users WHERE id = s2) IS DISTINCT FROM now() - interval '1 day' THEN
    RAISE EXCEPTION 'restore_trash_batch: il login non è tornato com''era prima del cestino';
  END IF;
  RAISE NOTICE 'Account nel cestino: genitore con 2 figli eliminato, login bloccati, visibile solo all''admin con 2FA';
END $$;

DO $$
DECLARE got text := pg_temp.changed_since('fp_family');
BEGIN
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'restore_trash_batch: dopo il ripristino dell''account sono diverse: %', got;
  END IF;
  RAISE NOTICE 'Account nel cestino: genitore e figli ripristinati identici, login sbloccati';
END $$;

UPDATE auth.users SET banned_until = NULL WHERE id = '00000000-0000-0000-0000-000000000102';

-- L'admin elimina S1 (il genitore P1 resta): il genitore non cambia, ripristino identico
CREATE TEMP TABLE fp_student AS SELECT * FROM pg_temp.fingerprint();

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  p1_before jsonb;
  b uuid;
  err text;
BEGIN
  SELECT to_jsonb(p) INTO p1_before FROM public.profiles p WHERE id = p1;
  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', s1, adm))::uuid;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = s1)
     OR (SELECT to_jsonb(p) FROM public.profiles p WHERE id = p1) IS DISTINCT FROM p1_before THEN
    RAISE EXCEPTION 'trash_account: eliminando S1 è cambiato il genitore (o S1 è ancora lì)';
  END IF;
  IF (SELECT array_agg(user_id) FROM public.account_trash WHERE batch_id = b) <> ARRAY[s1]
     OR (SELECT deleted_by FROM public.trash_batches WHERE batch_id = b) IS DISTINCT FROM adm THEN
    RAISE EXCEPTION 'account_trash: atteso solo S1, eliminato dall''admin';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: S1 non torna (%)', err; END IF;
END $$;

DO $$
DECLARE got text := pg_temp.changed_since('fp_student');
BEGIN
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'restore_trash_batch: dopo il ripristino di S1 sono diverse: %', got;
  END IF;
  RAISE NOTICE 'Account nel cestino: alunno eliminato dall''admin e ripristinato identico';
END $$;

-- Eliminazione definitiva
DO $$
DECLARE
  s8 constant uuid := '00000000-0000-0000-0000-000000000118';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  b_old uuid;
  b uuid;
  purged text;
  err text;
BEGIN
  DELETE FROM public.trash_items;
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', s8, 'authenticated', 'authenticated', 's8@test.local',
          '{"full_name":"Alunno S8"}', now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (s8, 'user');
  INSERT INTO public.enrollments (student_id, course_id, status) VALUES (s8, c1, 'active');
  INSERT INTO public.student_streaks (student_id) VALUES (s8);

  -- Prima l'admin toglie l'iscrizione (un batch a sé), poi l'account va nel cestino
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.enrollments WHERE student_id = %L', s8));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'enrollments: cancellazione non riuscita (%)', err; END IF;
  SELECT batch_id INTO b_old FROM public.trash_items ORDER BY id DESC LIMIT 1;
  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', s8, adm))::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b_old) THEN
    RAISE EXCEPTION 'trash_account: ha tolto dal cestino un batch con i dati dell''account';
  END IF;

  -- L'iscrizione non torna finché l'account è nel cestino
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_old));
  IF err IS NULL OR err NOT LIKE 'trash_missing_parent%' THEN
    RAISE EXCEPTION 'restore_trash_batch: iscrizione di un account nel cestino, atteso trash_missing_parent (%)', err;
  END IF;

  -- Solo il service role elimina per sempre un account
  IF pg_temp.run_as(adm, 'aal2', format('SELECT public.purge_account_trash(%L)', b)) IS NULL THEN
    RAISE EXCEPTION 'purge_account_trash: l''admin l''ha chiamata direttamente';
  END IF;
  purged := pg_temp.run_service(format('SELECT public.purge_account_trash(%L)', b));
  IF purged IS DISTINCT FROM format('{%s}', s8) THEN
    RAISE EXCEPTION 'purge_account_trash: attesi gli id {%}, avuti %', s8, purged;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = s8)
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = s8)
     OR EXISTS (SELECT 1 FROM public.account_trash)
     OR EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'purge_account_trash: restano login, ruoli o righe del cestino di S8';
  END IF;

  BEGIN
    PERFORM pg_temp.run_service(format('SELECT public.purge_account_trash(%L)', b));
    RAISE EXCEPTION 'purge_account_trash: un batch già eliminato non dà errore';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'trash_not_found%' THEN
      RAISE EXCEPTION 'purge_account_trash: batch già eliminato, atteso trash_not_found (%)', SQLERRM;
    END IF;
  END;
  RAISE NOTICE 'Account nel cestino: eliminazione definitiva di login, ruoli e righe nel cestino ok';
END $$;

-- Secondo genitore (drizzle/migrations/0077_second_parent.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova:
--   - admin_set_parent_children: solo l'admin con 2FA; un alunno senza genitore
--     diventa figlio principale, uno che ne ha già uno riceve il genitore in più;
--   - il secondo genitore vede il figlio come il principale (profilo, iscrizioni,
--     gruppo, lezioni del corso, profilo del docente);
--   - togliendo un figlio al principale, l'altro genitore diventa principale;
--   - trash_account del genitore principale: il figlio con un altro genitore resta
--     a lui e non va nel cestino; il ripristino ricollega chi si era eliminato;
--   - trash_account del secondo genitore: il figlio non cambia, il collegamento torna.
--
-- Persone nuove (P4, P5, S5, S6) per non dipendere da quello che hanno fatto i test precedenti.

-- Come 22_account_trash.sql: un comando come l'utente, NULL se è riuscito, altrimenti l'errore.
CREATE FUNCTION pg_temp.run_as(_uid uuid, _aal text, _sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('techland.trash_batch', '', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE _sql;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('techland.trash_batch', '', true);
  RETURN NULL;
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

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'authenticated', 'authenticated', 'p4@test.local', '{"full_name":"Genitore P4"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'authenticated', 'authenticated', 'p5@test.local', '{"full_name":"Genitore P5"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated', 's5@test.local', '{"full_name":"Alunno S5"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000106', 'authenticated', 'authenticated', 's6@test.local', '{"full_name":"Alunno S6"}', now(), now());
SET LOCAL session_replication_role = replica;
UPDATE public.profiles SET role = 'parent'
WHERE id IN ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205');
SET LOCAL session_replication_role = origin;
-- S5 nel gruppo G1 (corso C1, insegnante T1)
INSERT INTO public.enrollments (student_id, course_id, status)
VALUES ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-00000000c001', 'active');
INSERT INTO public.group_students (group_id, student_id)
VALUES ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000105');

-- Assegna figli
DO $$
DECLARE
  p4 constant uuid := '00000000-0000-0000-0000-000000000204';
  p5 constant uuid := '00000000-0000-0000-0000-000000000205';
  s5 constant uuid := '00000000-0000-0000-0000-000000000105';
  s6 constant uuid := '00000000-0000-0000-0000-000000000106';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  err text;
BEGIN
  err := pg_temp.run_as(adm, 'aal1', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L]::uuid[])', p4, s5));
  IF err IS NULL OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS NOT NULL THEN
    RAISE EXCEPTION 'admin_set_parent_children: riuscita all''admin senza 2FA';
  END IF;
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L, %L]::uuid[])', p4, s5, p5));
  IF err IS NULL OR err NOT LIKE '%non sono assegnabili%' THEN
    RAISE EXCEPTION 'admin_set_parent_children: accettato un genitore come figlio (%)', err;
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L]::uuid[])', p4, s5));
  IF err IS NOT NULL OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p4 THEN
    RAISE EXCEPTION 'admin_set_parent_children: S5 senza genitore non è diventato figlio di P4 (%)', err;
  END IF;

  -- P5: S5 ha già P4, quindi P5 è il secondo genitore; S6 è libero, quindi principale
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L, %L]::uuid[])', p5, s5, s6));
  IF err IS NOT NULL
     OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p4
     OR (SELECT parent_id FROM public.profiles WHERE id = s6) IS DISTINCT FROM p5
     OR NOT EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5 AND guardian_id = p5)
     OR EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s6) THEN
    RAISE EXCEPTION 'admin_set_parent_children: P5 doveva essere secondo genitore di S5 e principale di S6 (%)', err;
  END IF;
  -- Salvare di nuovo lo stesso elenco non cambia niente
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L, %L]::uuid[])', p5, s5, s6));
  IF err IS NOT NULL OR (SELECT count(*) FROM public.student_guardians WHERE guardian_id = p5) <> 1 THEN
    RAISE EXCEPTION 'admin_set_parent_children: il secondo salvataggio ha cambiato i collegamenti (%)', err;
  END IF;
  RAISE NOTICE 'Secondo genitore: l''admin con 2FA collega un alunno che ha già un genitore';

  -- Il secondo genitore vede il figlio come il principale
  IF pg_temp.count_as(p5, 'aal1', format('SELECT count(*)::int FROM public.profiles WHERE id IN (%L, %L)', s5, s6)) <> 2
     OR pg_temp.count_as(p5, 'aal1', format('SELECT count(*)::int FROM public.enrollments WHERE student_id = %L', s5)) <> 1
     OR pg_temp.count_as(p5, 'aal1', format('SELECT count(*)::int FROM public.group_students WHERE student_id = %L', s5)) <> 1
     OR pg_temp.count_as(p5, 'aal1', 'SELECT count(*)::int FROM public.student_groups') <> 1
     OR pg_temp.count_as(p5, 'aal1', $q$SELECT count(*)::int FROM public.lessons WHERE course_id = '00000000-0000-0000-0000-00000000c001'$q$) < 1
     OR pg_temp.count_as(p5, 'aal1', format('SELECT count(*)::int FROM public.get_children_ids(%L)', p5)) <> 2 THEN
    RAISE EXCEPTION 'secondo genitore: P5 non vede profilo, iscrizione, gruppo o lezioni di S5';
  END IF;
  IF to_regclass('public.teacher_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_profiles'
                   AND policyname = 'Parents can view teacher profiles of children groups')
     AND pg_temp.count_as(p5, 'aal1', format('SELECT count(*)::int FROM public.teacher_profiles WHERE user_id = %L', t1)) <> 1 THEN
    RAISE EXCEPTION 'secondo genitore: P5 non vede il profilo del docente di S5';
  END IF;
  -- Ma non può prendersi il posto del principale né aggiungersi altri figli
  PERFORM pg_temp.run_as(p5, 'aal1', format('UPDATE public.profiles SET parent_id = %L WHERE id = %L', p5, s5));
  PERFORM pg_temp.run_as(p5, 'aal1', format(
    $q$INSERT INTO public.student_guardians (student_id, guardian_id) VALUES ('00000000-0000-0000-0000-000000000104', %L)$q$, p5));
  IF (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p4
     OR EXISTS (SELECT 1 FROM public.student_guardians WHERE guardian_id = p5
                  AND student_id = '00000000-0000-0000-0000-000000000104') THEN
    RAISE EXCEPTION 'secondo genitore: P5 ha cambiato da solo i collegamenti';
  END IF;
  RAISE NOTICE 'Secondo genitore: vede profilo, iscrizioni, gruppo e lezioni del figlio, senza cambiare i collegamenti';

  -- Tolto al principale: l'altro genitore diventa principale
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[]::uuid[])', p4));
  IF err IS NOT NULL
     OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p5
     OR EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5) THEN
    RAISE EXCEPTION 'admin_set_parent_children: togliendo S5 a P4 doveva passare a P5 come principale (%)', err;
  END IF;
  -- Tolto all'unico genitore: resta senza
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L]::uuid[])', p5, s6));
  IF err IS NOT NULL OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS NOT NULL THEN
    RAISE EXCEPTION 'admin_set_parent_children: S5 tolto a P5 doveva restare senza genitore (%)', err;
  END IF;
  RAISE NOTICE 'Secondo genitore: togliendo il figlio al principale passa all''altro genitore';
END $$;

-- Cestino: P4 principale e P5 secondo genitore di S5
DO $$
DECLARE
  p4 constant uuid := '00000000-0000-0000-0000-000000000204';
  p5 constant uuid := '00000000-0000-0000-0000-000000000205';
  s5 constant uuid := '00000000-0000-0000-0000-000000000105';
  s6 constant uuid := '00000000-0000-0000-0000-000000000106';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  b uuid;
  err text;
BEGIN
  DELETE FROM public.trash_items;
  DELETE FROM public.account_trash;
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L]::uuid[])', p4, s5));
  err := coalesce(err, pg_temp.run_as(adm, 'aal2', format('SELECT public.admin_set_parent_children(%L, ARRAY[%L, %L]::uuid[])', p5, s5, s6)));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'preparazione: %', err; END IF;

  -- Il principale P4 si elimina: S5 resta a P5 e non va nel cestino
  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', p4, p4))::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = s5)
     OR (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p5
     OR EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5) THEN
    RAISE EXCEPTION 'trash_account: S5 doveva restare a P5 come figlio principale';
  END IF;
  IF (SELECT array_agg(user_id) FROM public.account_trash WHERE batch_id = b) <> ARRAY[p4]
     OR (SELECT banned_until FROM auth.users WHERE id = s5) IS NOT NULL THEN
    RAISE EXCEPTION 'trash_account: S5 è finito nel cestino o ha il login bloccato';
  END IF;
  IF (SELECT root_data->>'id' FROM public.trash_batches WHERE batch_id = b) IS DISTINCT FROM p4::text
     OR NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b AND table_name = 'student_guardians'
                      AND row_data->>'student_id' = s5::text AND row_data->>'guardian_id' = p4::text) THEN
    RAISE EXCEPTION 'trash_account: nel batch di P4 manca il collegamento a S5 da ripristinare';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: P4 non torna (%)', err; END IF;
  IF (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p5
     OR NOT EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5 AND guardian_id = p4)
     OR (SELECT banned_until FROM auth.users WHERE id = p4) IS NOT NULL THEN
    RAISE EXCEPTION 'restore_trash_batch: P4 doveva tornare come secondo genitore di S5';
  END IF;
  RAISE NOTICE 'Secondo genitore: il principale si elimina, il figlio resta all''altro e il ripristino lo ricollega';

  -- Il secondo genitore P4 si elimina: S5 non cambia, il collegamento torna col ripristino
  DELETE FROM public.trash_items;
  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', p4, adm))::uuid;
  IF (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p5
     OR EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5)
     OR (SELECT array_agg(user_id) FROM public.account_trash WHERE batch_id = b) <> ARRAY[p4] THEN
    RAISE EXCEPTION 'trash_account: eliminando il secondo genitore è cambiato il figlio';
  END IF;
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = s5 AND guardian_id = p4) THEN
    RAISE EXCEPTION 'restore_trash_batch: il secondo genitore non è tornato collegato (%)', err;
  END IF;
  RAISE NOTICE 'Secondo genitore: eliminato e ripristinato, il figlio resta al principale';
END $$;

-- Riga ridondante (il principale anche tra i genitori in più, inserita a mano):
-- trash_account la ignora, il figlio passa comunque all'altro genitore
DO $$
DECLARE
  p4 constant uuid := '00000000-0000-0000-0000-000000000204';
  p5 constant uuid := '00000000-0000-0000-0000-000000000205';
  s5 constant uuid := '00000000-0000-0000-0000-000000000105';
  b uuid;
BEGIN
  DELETE FROM public.trash_items;
  DELETE FROM public.account_trash;
  INSERT INTO public.student_guardians (student_id, guardian_id) VALUES (s5, p5);
  b := pg_temp.run_service(format('SELECT public.trash_account(%L, %L)', p5, p5))::uuid;
  IF (SELECT parent_id FROM public.profiles WHERE id = s5) IS DISTINCT FROM p4
     OR EXISTS (SELECT 1 FROM public.account_trash WHERE batch_id = b AND user_id = s5)
     OR NOT EXISTS (SELECT 1 FROM public.account_trash WHERE batch_id = b AND user_id = p5) THEN
    RAISE EXCEPTION 'trash_account: con la riga ridondante S5 doveva passare a P4 e restare fuori dal cestino';
  END IF;
  RAISE NOTICE 'Secondo genitore: una riga ridondante non porta il figlio nel cestino';
END $$;

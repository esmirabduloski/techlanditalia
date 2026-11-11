-- Rinumerazione dei task di una lezione (drizzle/migrations/0081_lesson_tasks_renumber.sql).
--   - l'admin elimina il task 3 di 5: il 4 diventa il 3, il 5 il 4, gli altri restano;
--   - progressi e id dei task non cambiano;
--   - ripristinato dal Cestino, il task torna 3 e quelli dopo tornano 4 e 5;
--   - eliminare una lezione intera con i suoi task funziona come prima;
--   - shift_lesson_tasks non è chiamabile dagli utenti.

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

-- Titoli dei task della lezione in ordine di numero, es. "1:A 2:B"
CREATE FUNCTION pg_temp.outline(_lesson uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(task_number || ':' || title, ' ' ORDER BY task_number)
  FROM public.lesson_tasks WHERE lesson_id = _lesson
$$;

DO $$
DECLARE
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  les uuid := gen_random_uuid();
  les2 uuid := gen_random_uuid();
  t4 uuid := gen_random_uuid();
  t3 uuid := gen_random_uuid();
  b uuid;
  err text;
  got text;
BEGIN
  INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES (les, c1, 50, 'Lezione rinumerazione');
  INSERT INTO public.lesson_tasks (id, lesson_id, task_number, title) VALUES
    (gen_random_uuid(), les, 1, 'A'), (gen_random_uuid(), les, 2, 'B'),
    (t3, les, 3, 'C'), (t4, les, 4, 'D'), (gen_random_uuid(), les, 5, 'E');
  INSERT INTO public.task_progress (student_id, task_id) VALUES (s1, t4);

  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lesson_tasks WHERE id = %L', t3));
  IF err IS NOT NULL THEN
    RAISE EXCEPTION 'renumber: l''admin non elimina il task: %', err;
  END IF;
  got := pg_temp.outline(les);
  IF got IS DISTINCT FROM '1:A 2:B 3:D 4:E' THEN
    RAISE EXCEPTION 'renumber: dopo l''eliminazione del 3 i task sono %', got;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_progress WHERE student_id = s1 AND task_id = t4) THEN
    RAISE EXCEPTION 'renumber: perso il progresso sul task scalato';
  END IF;

  SELECT batch_id INTO b FROM public.trash_items
  WHERE table_name = 'lesson_tasks' AND row_data->>'id' = t3::text;
  IF b IS NULL THEN
    RAISE EXCEPTION 'renumber: il task eliminato non è nel Cestino';
  END IF;
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL THEN
    RAISE EXCEPTION 'renumber: ripristino non riuscito: %', err;
  END IF;
  got := pg_temp.outline(les);
  IF got IS DISTINCT FROM '1:A 2:B 3:C 4:D 5:E' THEN
    RAISE EXCEPTION 'renumber: dopo il ripristino i task sono %', got;
  END IF;

  -- L'ultimo task: nessuno da scalare
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lesson_tasks WHERE lesson_id = %L AND task_number = 5', les));
  got := pg_temp.outline(les);
  IF err IS NOT NULL OR got IS DISTINCT FROM '1:A 2:B 3:C 4:D' THEN
    RAISE EXCEPTION 'renumber: eliminando l''ultimo task: % %', err, got;
  END IF;

  -- Più task in un colpo solo (2 e 3, consecutivi): restano 1, 2 senza buchi
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lesson_tasks WHERE lesson_id = %L AND task_number IN (2, 3)', les));
  got := pg_temp.outline(les);
  IF err IS NOT NULL OR got IS DISTINCT FROM '1:A 2:D' THEN
    RAISE EXCEPTION 'renumber: eliminando due task insieme: % %', err, got;
  END IF;

  -- Una lezione intera con i suoi task
  INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES (les2, c1, 51, 'Lezione da eliminare');
  INSERT INTO public.lesson_tasks (lesson_id, task_number, title) VALUES (les2, 1, 'X'), (les2, 2, 'Y');
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lessons WHERE id = %L', les2));
  IF err IS NOT NULL OR EXISTS (SELECT 1 FROM public.lesson_tasks WHERE lesson_id = les2) THEN
    RAISE EXCEPTION 'renumber: eliminando una lezione intera: %', err;
  END IF;

  -- Non chiamabile dagli utenti
  IF pg_temp.run_as(t1, 'aal2', format('SELECT public.shift_lesson_tasks(%L, 1, 5)', les)) IS NULL
     OR has_function_privilege('authenticated', 'public.shift_lesson_tasks(uuid, int, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'renumber: shift_lesson_tasks chiamabile dagli utenti';
  END IF;

  DELETE FROM public.lessons WHERE id = les;
  RAISE NOTICE 'Rinumerazione dei task: eliminazione singola e multipla, Cestino ed eliminazione della lezione verificati';
END $$;

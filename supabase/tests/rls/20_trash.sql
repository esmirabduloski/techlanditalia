-- Cestino delle eliminazioni (drizzle/migrations/0069_trash.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova il cestino come i vari utenti:
--   - il trigger è sulle tabelle cancellate dall'admin e sulle loro figlie, non su account e ruoli;
--   - l'admin cancella un corso: corso, lezioni, gruppi, consegne… finiscono in un solo batch;
--   - solo l'admin con 2FA vede il cestino, ripristina ed elimina definitivamente;
--   - il ripristino rimette il database com'era (niente monte ore scalato due volte,
--     niente punti doppi, niente calendario rigenerato) e il batch esce dal cestino;
--   - le eliminazioni di insegnanti e service role non entrano nel cestino;
--   - il compito stagionale torna nella lezione ripristinata;
--   - un lead CRM torna con pagamenti e valore cliente;
--   - un conflitto (stesso slug) o un genitore mancante annullano tutto il ripristino;
--   - un account eliminato porta via dal cestino le righe con i suoi dati;
--   - dopo 30 giorni cleanup_old_logs() svuota il cestino.
--
-- Mondo di 01_seed.sql: corso C1 (lezione e001, gruppo G1 di T1: S1, S3),
-- corso C2 (lezione e002, gruppo G2 di T2: S2, S3, S4); P1 genitore di S1 e S2.

-- Esegue un comando come l'utente, come una richiesta a sé dell'app (un batch a sé):
-- NULL se è riuscito, altrimenti l'errore. Un UPDATE/DELETE bloccato dall'RLS non dà
-- errore ma non tocca righe: lo segnala come tale.
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

-- Esegue una query che restituisce un numero (es. un conteggio) come l'utente.
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

-- Impronta di ogni tabella (senza updated_at e senza dirty_at, che chiede apposta
-- di risincronizzare il calendario Google): serve a dire se il ripristino ha
-- rimesso tutto com'era e senza effetti collaterali.
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

CREATE FUNCTION pg_temp.last_batch() RETURNS uuid LANGUAGE sql AS $$
  SELECT batch_id FROM public.trash_items ORDER BY id DESC LIMIT 1
$$;

-- Trigger: su contenuti, gruppi e CRM e sulle figlie a cascata, mai su account e ruoli
DO $$
DECLARE missing text; extra text;
BEGIN
  SELECT string_agg(t, ', ') INTO missing
  FROM unnest(ARRAY['courses', 'lessons', 'lesson_tasks', 'homework', 'homework_submissions',
                    'student_groups', 'group_students', 'group_attendance', 'group_lesson_schedule',
                    'homework_group_deadlines', 'enrollments', 'crm_leads', 'crm_payments',
                    'crm_interactions', 'trial_bookings', 'blog_posts', 'glossary_terms']) t
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgname = 'a_trash_capture'
                      AND g.tgrelid = format('public.%I', t)::regclass);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'trash: manca il trigger su %', missing;
  END IF;

  -- I profili solo dentro trash_account() (0076, vedi 22_account_trash.sql)
  SELECT string_agg(c.relname, ', ') INTO extra
  FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
  WHERE g.tgname = 'a_trash_capture'
    AND (c.relname IN ('user_roles', 'trash_items')
         OR (c.relname = 'profiles' AND encode(g.tgargs, 'escape') NOT LIKE 'account_only%'));
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'trash: trigger su tabelle che non devono passare dal cestino: %', extra;
  END IF;

  -- La lezione si porta dietro i compiti stagionali da ricollegare
  IF NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgname = 'a_trash_capture'
                   AND g.tgrelid = 'public.lessons'::regclass
                   AND encode(g.tgargs, 'escape') LIKE '%homework|lesson_id|id%') THEN
    RAISE EXCEPTION 'trash: il trigger delle lezioni non ricollega i compiti stagionali';
  END IF;

  RAISE NOTICE 'Cestino: trigger su % tabelle',
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'a_trash_capture');
END $$;

-- Corso intero: un batch, visibile solo all'admin con 2FA, ripristino identico.
-- Un corso proposto a un alunno non si può cancellare (course_proposals senza
-- cascata): per il test le proposte verso C1 passano a C2, poi tornano.
CREATE TEMP TABLE moved_proposals AS
SELECT id FROM public.course_proposals WHERE proposed_course_id = '00000000-0000-0000-0000-00000000c001';
UPDATE public.course_proposals SET proposed_course_id = '00000000-0000-0000-0000-00000000c002'
WHERE id IN (SELECT id FROM moved_proposals);
CREATE TEMP TABLE fp_course AS SELECT * FROM pg_temp.fingerprint();

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  q constant text := 'SELECT count(*)::int FROM public.trash_items';
  qb constant text := 'SELECT count(*)::int FROM public.trash_batches';
  b uuid;
  title text;
  err text;
  got text;
  n int;
BEGIN
  -- Si parte da un cestino vuoto: 01_seed.sql ha una riga finta per 02_checks.sql
  -- e le prove precedenti cancellano anche come admin.
  DELETE FROM public.trash_items;

  SELECT c.title INTO title FROM public.courses c WHERE c.id = c1;
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.courses WHERE id = %L', c1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'courses: l''admin non riesce a cancellare il corso (%)', err; END IF;

  IF (SELECT count(DISTINCT batch_id) FROM public.trash_items) <> 1 THEN
    RAISE EXCEPTION 'trash: il corso cancellato è finito in più batch';
  END IF;
  b := pg_temp.last_batch();
  SELECT string_agg(t, ', ') INTO got
  FROM unnest(ARRAY['courses', 'lessons', 'lesson_tasks', 'homework', 'homework_submissions',
                    'student_groups', 'group_students', 'group_attendance', 'enrollments']) t
  WHERE NOT EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b AND table_name = t);
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'trash: nel batch del corso mancano %', got;
  END IF;
  IF (SELECT root_table FROM public.trash_batches WHERE batch_id = b) <> 'courses'
     OR (SELECT root_data->>'title' FROM public.trash_batches WHERE batch_id = b) IS DISTINCT FROM title
     OR (SELECT deleted_by FROM public.trash_batches WHERE batch_id = b) <> adm
     OR (SELECT total FROM public.trash_batches WHERE batch_id = b) <> (SELECT count(*) FROM public.trash_items) THEN
    RAISE EXCEPTION 'trash_batches: riepilogo del corso sbagliato';
  END IF;

  -- Visibilità
  IF pg_temp.count_as(s1, 'aal1', q) <> 0 OR pg_temp.count_as(p1, 'aal1', q) <> 0
     OR pg_temp.count_as(t1, 'aal2', q) <> 0 OR pg_temp.count_as(adm, 'aal1', q) <> 0
     OR pg_temp.count_as(t1, 'aal2', qb) <> 0 OR pg_temp.count_as(adm, 'aal1', qb) <> 0 THEN
    RAISE EXCEPTION 'trash_items: un non-admin (o l''admin senza 2FA) vede il cestino';
  END IF;
  IF pg_temp.count_as(adm, 'aal2', q) = 0 OR pg_temp.count_as(adm, 'aal2', qb) <> 1 THEN
    RAISE EXCEPTION 'trash_items: l''admin con 2FA non vede il cestino';
  END IF;

  -- Nessuno scrive direttamente nel cestino
  IF pg_temp.run_as(adm, 'aal2', 'DELETE FROM public.trash_items') IS NULL
     OR pg_temp.run_as(adm, 'aal2', 'UPDATE public.trash_items SET table_name = ''x''') IS NULL
     OR pg_temp.run_as(adm, 'aal2', format(
          'INSERT INTO public.trash_items (batch_id, table_name, row_data) VALUES (%L, ''courses'', ''{}'')', b)) IS NULL THEN
    RAISE EXCEPTION 'trash_items: l''admin scrive direttamente nella tabella del cestino';
  END IF;

  -- Ripristino ed eliminazione definitiva: solo admin con 2FA
  FOR err IN
    SELECT pg_temp.run_as(u, a, format('SELECT public.%s(%L)', f, b))
    FROM (VALUES (s1, 'aal1'), (p1, 'aal1'), (t1, 'aal2'), (adm, 'aal1')) v(u, a),
         unnest(ARRAY['restore_trash_batch', 'purge_trash_batch']) f
  LOOP
    IF err IS NULL THEN RAISE EXCEPTION 'trash: un non-admin (o l''admin senza 2FA) ha ripristinato o eliminato'; END IF;
  END LOOP;
  IF pg_temp.run_as(t1, 'aal2', 'SELECT public.empty_trash()') IS NULL THEN
    RAISE EXCEPTION 'trash: un insegnante ha svuotato il cestino';
  END IF;
  SELECT count(*) INTO n FROM public.trash_items WHERE batch_id = b;
  IF n = 0 THEN RAISE EXCEPTION 'trash: il batch è sparito senza ripristino'; END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: il corso non torna (%)', err; END IF;
  IF EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'restore_trash_batch: il batch ripristinato è rimasto nel cestino';
  END IF;

  -- Trigger riaccesi
  IF EXISTS (SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
             JOIN pg_namespace ns ON ns.oid = c.relnamespace
             WHERE ns.nspname = 'public' AND NOT g.tgisinternal AND g.tgenabled = 'D') THEN
    RAISE EXCEPTION 'restore_trash_batch: dopo il ripristino ci sono trigger spenti: %',
      (SELECT string_agg(c.relname || '.' || g.tgname, ', ') FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
       WHERE NOT g.tgisinternal AND g.tgenabled = 'D');
  END IF;

  RAISE NOTICE 'Cestino: corso con % righe collegate cancellato e visibile solo all''admin con 2FA', n;
END $$;

DO $$
DECLARE got text := pg_temp.changed_since('fp_course');
BEGIN
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'restore_trash_batch: dopo il ripristino del corso sono diverse: %', got;
  END IF;
  RAISE NOTICE 'Cestino: corso ripristinato identico (monte ore, punti, calendario, iscrizioni invariati)';
END $$;

UPDATE public.course_proposals SET proposed_course_id = '00000000-0000-0000-0000-00000000c001'
WHERE id IN (SELECT id FROM moved_proposals);

-- Fuori dal cestino: insegnanti e service role
DO $$
DECLARE
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  err text;
BEGIN
  err := pg_temp.run_as(t1, 'aal2', format('DELETE FROM public.group_comments WHERE group_id = %L', g1));
  INSERT INTO public.glossary_terms (term, slug, definition)
  VALUES ('Termine di prova', 'termine-di-prova', 'Solo per il test') ON CONFLICT DO NOTHING;
  DELETE FROM public.glossary_terms WHERE slug = 'termine-di-prova';
  IF EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'trash: catturata un''eliminazione di insegnante o service role (%)',
      (SELECT string_agg(DISTINCT table_name, ', ') FROM public.trash_items);
  END IF;
  -- Rimette la nota di gruppo se l'insegnante l'ha cancellata
  IF err IS NULL THEN
    INSERT INTO public.group_comments (group_id, author_id, content) VALUES (g1, t1, 'Nota su G1');
  END IF;
  RAISE NOTICE 'Cestino: eliminazioni di insegnanti e service role escluse';
END $$;

-- Compito stagionale: torna nella lezione ripristinata
DO $$
DECLARE
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c2 constant uuid := '00000000-0000-0000-0000-00000000c002';
  e002 constant uuid := '00000000-0000-0000-0000-00000000e002';
  d002 constant uuid := '00000000-0000-0000-0000-00000000d002';
  hw constant uuid := '00000000-0000-0000-0000-00000000d201';
  err text;
BEGIN
  INSERT INTO public.homework (id, title, seasonal_theme_id, course_id, lesson_id)
  SELECT hw, 'Missione ' || name, id, c2, e002 FROM public.seasonal_themes WHERE name = 'Halloween';

  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lessons WHERE id = %L', e002));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'lessons: l''admin non riesce a cancellare la lezione (%)', err; END IF;
  IF (SELECT lesson_id FROM public.homework WHERE id = hw) IS NOT NULL OR EXISTS (SELECT 1 FROM public.homework WHERE id = d002) THEN
    RAISE EXCEPTION 'lessons: la lezione cancellata non ha archiviato il compito stagionale o tolto quello normale';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', pg_temp.last_batch()));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: la lezione non torna (%)', err; END IF;
  IF (SELECT lesson_id FROM public.homework WHERE id = hw) IS DISTINCT FROM e002 THEN
    RAISE EXCEPTION 'restore_trash_batch: il compito stagionale non è tornato nella lezione';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.homework WHERE id = d002 AND lesson_id = e002)
     OR NOT EXISTS (SELECT 1 FROM public.homework_submissions WHERE homework_id = d002) THEN
    RAISE EXCEPTION 'restore_trash_batch: il compito normale o le sue consegne non sono tornati';
  END IF;

  DELETE FROM public.homework WHERE id = hw;
  RAISE NOTICE 'Cestino: lezione ripristinata con il suo compito stagionale';
END $$;

-- Lead CRM con pagamenti: tornano lead, pagamenti e valore cliente
CREATE TEMP TABLE fp_lead AS SELECT * FROM pg_temp.fingerprint();

DO $$
DECLARE
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  lead uuid;
  ltv bigint;
  err text;
BEGIN
  SELECT l.id, l.lifetime_value_cents INTO lead, ltv
  FROM public.crm_leads l WHERE EXISTS (SELECT 1 FROM public.crm_payments p WHERE p.lead_id = l.id)
  ORDER BY l.email LIMIT 1;
  UPDATE public.crm_payments SET status = 'paid', paid_at = now() WHERE lead_id = lead;
  SELECT lifetime_value_cents INTO ltv FROM public.crm_leads WHERE id = lead;
  IF coalesce(ltv, 0) = 0 THEN RAISE EXCEPTION 'crm_leads: valore cliente di prova nullo'; END IF;
  DROP TABLE fp_lead;
  CREATE TEMP TABLE fp_lead AS SELECT * FROM pg_temp.fingerprint();

  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.crm_leads WHERE id = %L', lead));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'crm_leads: l''admin non riesce a cancellare il lead (%)', err; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trash_items WHERE table_name = 'crm_payments') THEN
    RAISE EXCEPTION 'trash: i pagamenti del lead non sono nel batch';
  END IF;

  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', pg_temp.last_batch()));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: il lead non torna (%)', err; END IF;
  IF (SELECT lifetime_value_cents FROM public.crm_leads WHERE id = lead) IS DISTINCT FROM ltv THEN
    RAISE EXCEPTION 'restore_trash_batch: valore cliente del lead sbagliato dopo il ripristino';
  END IF;
  RAISE NOTICE 'Cestino: lead ripristinato con pagamenti e valore cliente';
END $$;

DO $$
DECLARE got text := pg_temp.changed_since('fp_lead');
BEGIN
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'restore_trash_batch: dopo il ripristino del lead sono diverse: %', got;
  END IF;
END $$;

-- Conflitti e genitori mancanti: il ripristino non fa niente a metà
DO $$
DECLARE
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  c9 constant uuid := '00000000-0000-0000-0000-00000000c009';
  e9 constant uuid := '00000000-0000-0000-0000-00000000e009';
  b_lesson uuid;
  b_course uuid;
  n int;
  err text;
BEGIN
  INSERT INTO public.courses (id, slug, title, is_visible) VALUES (c9, 'test-c9', 'Corso C9', false);
  INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES (e9, c9, 1, 'Lezione C9');

  -- Prima la lezione, poi il corso: due batch
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lessons WHERE id = %L', e9));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'lessons: cancellazione non riuscita (%)', err; END IF;
  b_lesson := pg_temp.last_batch();
  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.courses WHERE id = %L', c9));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'courses: cancellazione non riuscita (%)', err; END IF;
  b_course := pg_temp.last_batch();
  IF b_lesson = b_course THEN RAISE EXCEPTION 'trash: due richieste nello stesso batch'; END IF;
  SELECT count(*) INTO n FROM public.trash_items WHERE batch_id IN (b_lesson, b_course);

  -- La lezione senza il suo corso non torna
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_lesson));
  IF err IS NULL OR err NOT LIKE 'trash_missing_parent%' THEN
    RAISE EXCEPTION 'restore_trash_batch: lezione senza corso, atteso trash_missing_parent (%)', err;
  END IF;

  -- Un corso nuovo con lo stesso slug blocca il ripristino del vecchio
  INSERT INTO public.courses (slug, title, is_visible) VALUES ('test-c9', 'Corso C9 nuovo', false);
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_course));
  IF err IS NULL OR err NOT LIKE 'trash_conflict%' THEN
    RAISE EXCEPTION 'restore_trash_batch: slug doppio, atteso trash_conflict (%)', err;
  END IF;
  IF EXISTS (SELECT 1 FROM public.courses WHERE id = c9)
     OR (SELECT count(*) FROM public.trash_items WHERE batch_id IN (b_lesson, b_course)) <> n THEN
    RAISE EXCEPTION 'restore_trash_batch: un ripristino fallito ha lasciato qualcosa a metà';
  END IF;

  -- Tolto il doppione, prima il corso e poi la lezione
  DELETE FROM public.courses WHERE slug = 'test-c9';
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_course));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: corso C9 non tornato (%)', err; END IF;
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_lesson));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'restore_trash_batch: lezione C9 non tornata (%)', err; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = e9 AND course_id = c9) THEN
    RAISE EXCEPTION 'restore_trash_batch: lezione C9 non ripristinata';
  END IF;

  -- Un batch già ripristinato non c'è più
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', b_lesson));
  IF err IS NULL OR err NOT LIKE 'trash_not_found%' THEN
    RAISE EXCEPTION 'restore_trash_batch: batch già ripristinato, atteso trash_not_found (%)', err;
  END IF;

  -- Eliminazione definitiva e svuotamento
  PERFORM pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.lessons WHERE id = %L', e9));
  b_lesson := pg_temp.last_batch();
  PERFORM pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.courses WHERE id = %L', c9));
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.purge_trash_batch(%L)', b_lesson));
  IF err IS NOT NULL OR EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b_lesson) THEN
    RAISE EXCEPTION 'purge_trash_batch: il batch non è stato eliminato (%)', err;
  END IF;
  err := pg_temp.run_as(adm, 'aal2', 'SELECT public.empty_trash()');
  IF err IS NOT NULL OR EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'empty_trash: il cestino non è vuoto (%)', err;
  END IF;

  RAISE NOTICE 'Cestino: conflitti, genitori mancanti, eliminazione definitiva e svuotamento ok';
END $$;

-- Account eliminato e pulizia dopo 30 giorni
DO $$
DECLARE
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  s9 constant uuid := '00000000-0000-0000-0000-000000000109';
  d001 constant uuid := '00000000-0000-0000-0000-00000000d001';
  b_old uuid;
  err text;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', s9, 'authenticated', 'authenticated', 's9@test.local',
          '{"full_name":"Alunno S9"}', now(), now());
  INSERT INTO public.homework_submissions (student_id, homework_id, status, notes) VALUES (s9, d001, 'pending', 'consegna S9');

  err := pg_temp.run_as(adm, 'aal2', format('DELETE FROM public.homework_submissions WHERE student_id = %L', s9));
  IF err IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.trash_items WHERE row_data->>'student_id' = s9::text) THEN
    RAISE EXCEPTION 'trash: la consegna di S9 non è nel cestino (%)', err;
  END IF;
  DELETE FROM auth.users WHERE id = s9;
  IF EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'trash_forget_profile: dopo l''eliminazione dell''account restano suoi dati nel cestino';
  END IF;

  -- Due eliminazioni di presenze (lezione 77, solo per questo test): una di 31 giorni fa, una di oggi
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number) VALUES
    ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 77),
    ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000102', 77);
  PERFORM pg_temp.run_as(adm, 'aal2', 'DELETE FROM public.group_attendance WHERE lesson_number = 77 AND group_id = ''00000000-0000-0000-0000-00000000a001''');
  b_old := pg_temp.last_batch();
  UPDATE public.trash_items SET deleted_at = now() - interval '31 days' WHERE batch_id = b_old;
  PERFORM pg_temp.run_as(adm, 'aal2', 'DELETE FROM public.group_attendance WHERE lesson_number = 77 AND group_id = ''00000000-0000-0000-0000-00000000a002''');
  IF (SELECT count(DISTINCT batch_id) FROM public.trash_items) <> 2 THEN
    RAISE EXCEPTION 'trash: attesi due batch di presenze';
  END IF;

  PERFORM public.cleanup_old_logs();
  IF EXISTS (SELECT 1 FROM public.trash_items WHERE batch_id = b_old)
     OR NOT EXISTS (SELECT 1 FROM public.trash_items) THEN
    RAISE EXCEPTION 'cleanup_old_logs: il cestino non rispetta i 30 giorni';
  END IF;

  -- Le presenze di oggi tornano; poi via, fuori dal cestino
  err := pg_temp.run_as(adm, 'aal2', format('SELECT public.restore_trash_batch(%L)', pg_temp.last_batch()));
  IF err IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.group_attendance WHERE lesson_number = 77) THEN
    RAISE EXCEPTION 'restore_trash_batch: presenze non tornate (%)', err;
  END IF;
  DELETE FROM public.group_attendance WHERE lesson_number = 77;

  RAISE NOTICE 'Cestino: account eliminati dimenticati, pulizia dopo 30 giorni ok';
END $$;

-- Verifica dei permessi (RLS) sui dati di 01_seed.sql.
--
-- Per ogni persona (alunni, genitori, insegnanti) e per ogni tabella di
-- "public" il test entra nel database come quella persona, esattamente come
-- fa l'app (ruolo authenticated + JWT), e controlla che:
--   1. LETTURA   ogni riga visibile appartenga a qualcuno che la persona può
--                vedere (sé stessa, i propri figli, gli alunni dei propri gruppi);
--   2. MODIFICA  non riesca ad aggiornare né cancellare le righe degli altri;
--   3. una serie di tentativi espliciti di scalata (darsi il ruolo admin,
--      entrare in un altro gruppo, prendersi un gruppo altrui...) fallisca;
--   4. le persone vedano davvero i propri dati (altrimenti il test passerebbe
--      anche con un database che nega tutto).
--
-- Le tabelle senza colonne che indicano a chi appartiene la riga sono
-- considerate solo-admin, a meno che non siano nell'elenco "contenuti
-- condivisi" qui sotto. Una tabella nuova quindi è protetta di default: se
-- deve essere visibile agli utenti, va aggiunta qui con il motivo.
--
-- Gira come postgres in una transazione che non salva nulla.

\o /dev/null
CREATE SCHEMA rls_test;

-- ── Persone ────────────────────────────────────────────────────────────────
CREATE TABLE rls_test.personas (name text PRIMARY KEY, uid uuid NOT NULL, kind text NOT NULL, aal text NOT NULL);
INSERT INTO rls_test.personas VALUES
  ('alunno S1',     '00000000-0000-0000-0000-000000000101', 'student', 'aal1'),
  ('alunno S2',     '00000000-0000-0000-0000-000000000102', 'student', 'aal1'),
  ('alunno S3',     '00000000-0000-0000-0000-000000000103', 'student', 'aal1'),
  ('alunno S4',     '00000000-0000-0000-0000-000000000104', 'student', 'aal1'),
  ('genitore P1',   '00000000-0000-0000-0000-000000000201', 'parent',  'aal1'),
  ('genitore P2',   '00000000-0000-0000-0000-000000000202', 'parent',  'aal1'),
  ('genitore P3',   '00000000-0000-0000-0000-000000000203', 'parent',  'aal1'),
  ('insegnante T1', '00000000-0000-0000-0000-000000000301', 'teacher', 'aal2'),
  ('insegnante T2', '00000000-0000-0000-0000-000000000302', 'teacher', 'aal2');

-- ── Contenuti condivisi: visibili a tutti gli utenti, non sono dati personali ─
CREATE TABLE rls_test.shared_tables (tbl text PRIMARY KEY, reason text NOT NULL);
INSERT INTO rls_test.shared_tables VALUES
  ('courses',                 'catalogo corsi'),
  ('lessons',                 'contenuti didattici'),
  ('lesson_tasks',            'contenuti didattici'),
  ('homework',                'testo dei compiti (le consegne sono in homework_submissions)'),
  ('scheduled_lessons',       'calendario delle lezioni del corso'),
  ('badges',                  'elenco dei badge'),
  ('gamification_levels',     'livelli della gamification'),
  ('blog_posts',              'articoli pubblicati'),
  ('glossary_terms',          'glossario pubblico'),
  ('landing_pages',           'pagine pubbliche'),
  ('site_settings',           'impostazioni pubbliche del sito'),
  ('featured_products',       'prodotti in evidenza'),
  ('legal_document_versions', 'versioni di privacy e termini'),
  ('ai_consent_versions',     'versioni dell''informativa sugli strumenti AI'),
  ('teacher_links',           'link utili per i docenti'),
  ('school_closures',         'calendario di chiusure e festività'),
  ('seasonal_themes',         'temi dei compiti stagionali');

-- Tabelle solo-admin anche se hanno una colonna che punta a un utente
-- (es. il lead CRM collegato a un genitore: il genitore non deve vederlo).
CREATE TABLE rls_test.admin_only_tables (tbl text PRIMARY KEY, reason text NOT NULL);
INSERT INTO rls_test.admin_only_tables VALUES
  ('crm_leads',         'CRM interno'),
  ('crm_interactions',  'CRM interno'),
  ('crm_payments',      'CRM interno'),
  ('subscription_cancellations', 'questionario di disdetta, CRM interno'),
  ('monthly_reports',   'report mensile, numeri interni'),
  ('admin_access_logs', 'log degli accessi admin'),
  ('email_log',         'registro delle email inviate: il destinatario non lo vede'),
  ('trash_items',       'cestino delle eliminazioni: copie di righe di chiunque'),
  ('account_trash',     'account nel cestino: elenco per gli admin');

CREATE FUNCTION rls_test.group_col(_tbl text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN _tbl IN (SELECT tbl FROM rls_test.admin_only_tables) THEN NULL
              WHEN _tbl = 'student_groups' THEN 'id' ELSE (
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _tbl AND column_name = 'group_id') END
$$;

-- Da quale colonna si capisce di chi è la riga (la prima presente vince).
-- teacher_id conta solo nelle tabelle senza group_id (es. le notifiche del
-- docente); dove c'è group_id decide il gruppo.
CREATE FUNCTION rls_test.subject_col(_tbl text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN _tbl IN (SELECT tbl FROM rls_test.admin_only_tables) THEN NULL
    WHEN _tbl = 'profiles' THEN 'id' ELSE (
    SELECT c.column_name FROM information_schema.columns c
    JOIN unnest(ARRAY['student_id', 'user_id', 'accepted_by', 'referrer_id', 'teacher_id'])
         WITH ORDINALITY AS k(col, ord) ON k.col = c.column_name
    WHERE c.table_schema = 'public' AND c.table_name = _tbl
      AND NOT (c.column_name = 'teacher_id' AND rls_test.group_col(_tbl) IS NOT NULL)
    ORDER BY k.ord LIMIT 1) END
$$;


-- Corso a cui appartiene la riga: un insegnante deve vedere i dati dei suoi
-- alunni solo per i corsi dei propri gruppi, non quelli dei gruppi di altri.
CREATE TABLE rls_test.course_expr (tbl text PRIMARY KEY, expr text NOT NULL);
INSERT INTO rls_test.course_expr VALUES
  ('homework_submissions', '(SELECT l.course_id FROM public.homework h JOIN public.lessons l ON l.id = h.lesson_id WHERE h.id = t.homework_id)'),
  ('lesson_progress',      '(SELECT l.course_id FROM public.lessons l WHERE l.id = t.lesson_id)'),
  ('task_progress',        '(SELECT l.course_id FROM public.lesson_tasks k JOIN public.lessons l ON l.id = k.lesson_id WHERE k.id = t.task_id)'),
  ('attendance',           '(SELECT s.course_id FROM public.scheduled_lessons s WHERE s.id = t.scheduled_lesson_id)'),
  ('student_code_drafts',  '(SELECT l.course_id FROM public.lessons l WHERE l.id = coalesce(t.lesson_id,
                              (SELECT k.lesson_id FROM public.lesson_tasks k WHERE k.id = t.task_id),
                              (SELECT h.lesson_id FROM public.homework h WHERE h.id = t.homework_id)))');

CREATE FUNCTION rls_test.course_of(_tbl text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT expr FROM rls_test.course_expr WHERE tbl = _tbl),
    (SELECT 't.course_id' FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = _tbl AND column_name = 'course_id'))
$$;

-- ── Chi può vedere chi (calcolato dai dati, senza RLS) ─────────────────────
CREATE TABLE rls_test.allowed_users (persona text, uid uuid);
INSERT INTO rls_test.allowed_users
SELECT name, uid FROM rls_test.personas
UNION SELECT p.name, pr.id FROM rls_test.personas p JOIN public.profiles pr ON pr.parent_id = p.uid WHERE p.kind = 'parent'
UNION SELECT p.name, g.student_id FROM rls_test.personas p JOIN public.student_guardians g ON g.guardian_id = p.uid WHERE p.kind = 'parent'
UNION SELECT p.name, gs.student_id FROM rls_test.personas p
      JOIN public.student_groups sg ON sg.teacher_id = p.uid JOIN public.group_students gs ON gs.group_id = sg.id
      WHERE p.kind = 'teacher';

CREATE TABLE rls_test.allowed_groups (persona text, gid uuid);
INSERT INTO rls_test.allowed_groups
SELECT p.name, gs.group_id FROM rls_test.personas p JOIN public.group_students gs ON gs.student_id = p.uid WHERE p.kind = 'student'
UNION SELECT p.name, gs.group_id FROM rls_test.personas p
      JOIN public.profiles pr ON pr.parent_id = p.uid JOIN public.group_students gs ON gs.student_id = pr.id
      WHERE p.kind = 'parent'
UNION SELECT p.name, gs.group_id FROM rls_test.personas p
      JOIN public.student_guardians g ON g.guardian_id = p.uid JOIN public.group_students gs ON gs.student_id = g.student_id
      WHERE p.kind = 'parent'
UNION SELECT p.name, sg.id FROM rls_test.personas p JOIN public.student_groups sg ON sg.teacher_id = p.uid WHERE p.kind = 'teacher';

CREATE TABLE rls_test.allowed_courses (persona text, cid uuid);
INSERT INTO rls_test.allowed_courses
SELECT p.name, sg.course_id FROM rls_test.personas p JOIN public.student_groups sg ON sg.teacher_id = p.uid WHERE p.kind = 'teacher';

-- Alunni e genitori possono vedere il profilo docente dei propri insegnanti.
CREATE TABLE rls_test.allowed_teachers (persona text, uid uuid);
INSERT INTO rls_test.allowed_teachers
SELECT a.persona, sg.teacher_id FROM rls_test.allowed_groups a JOIN public.student_groups sg ON sg.id = a.gid;

-- ── A chi appartiene ogni riga ─────────────────────────────────────────────
CREATE TABLE rls_test.tables AS
SELECT c.relname::text AS tbl,
       rls_test.subject_col(c.relname) AS subject_col,
       rls_test.group_col(c.relname) AS group_col,
       rls_test.course_of(c.relname) AS course_expr,
       EXISTS (SELECT 1 FROM rls_test.shared_tables s WHERE s.tbl = c.relname) AS shared
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';

CREATE TABLE rls_test.row_scope (tbl text, rid tid, subject uuid, grp uuid, course uuid);
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM rls_test.tables WHERE NOT shared LOOP
    EXECUTE format('INSERT INTO rls_test.row_scope SELECT %L, t.ctid, %s, %s, %s FROM public.%I t',
      t.tbl,
      coalesce('t.' || quote_ident(t.subject_col) || '::uuid', 'NULL::uuid'),
      coalesce('t.' || quote_ident(t.group_col) || '::uuid', 'NULL::uuid'),
      coalesce(t.course_expr || '::uuid', 'NULL::uuid'),
      t.tbl);
  END LOOP;
END $$;

-- Una riga è "permessa" a una persona se appartiene a qualcuno che può vedere,
-- è di un suo gruppo e, per gli insegnanti, di un corso dei suoi gruppi.
CREATE FUNCTION rls_test.allowed(_persona text, _tbl text, _subject uuid, _grp uuid, _course uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (_subject IS NOT NULL OR _grp IS NOT NULL)
     AND (_subject IS NULL
          OR EXISTS (SELECT 1 FROM rls_test.allowed_users WHERE persona = _persona AND uid = _subject)
          OR (_tbl = 'teacher_profiles'
              AND EXISTS (SELECT 1 FROM rls_test.allowed_teachers WHERE persona = _persona AND uid = _subject)))
     AND (_grp IS NULL OR EXISTS (SELECT 1 FROM rls_test.allowed_groups WHERE persona = _persona AND gid = _grp))
     AND (_course IS NULL
          OR (SELECT kind FROM rls_test.personas WHERE name = _persona) <> 'teacher'
          OR EXISTS (SELECT 1 FROM rls_test.allowed_courses WHERE persona = _persona AND cid = _course))
$$;

-- Il ruolo authenticated deve poter richiamare logout() per tornare postgres.
GRANT USAGE ON SCHEMA rls_test TO authenticated;

CREATE TABLE rls_test.failures (msg text);
CREATE TABLE rls_test.stats (checks int);
INSERT INTO rls_test.stats VALUES (0);

-- ── Strumenti per agire come una persona ───────────────────────────────────
CREATE FUNCTION rls_test.login(_uid uuid, _aal text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION rls_test.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- Esegue una query come _uid e restituisce un intero (es. un conteggio).
-- Restituisce NULL se la query va in errore.
CREATE FUNCTION rls_test.scalar_as(_uid uuid, _aal text, _sql text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  BEGIN
    PERFORM rls_test.login(_uid, _aal);
    EXECUTE _sql INTO n;
    PERFORM rls_test.logout();
  EXCEPTION WHEN OTHERS THEN
    PERFORM rls_test.logout();
    n := NULL;
  END;
  RETURN n;
END $$;

-- Esegue una modifica come _uid, conta le righe toccate e annulla tutto.
-- Restituisce NULL se la modifica è stata rifiutata con un errore.
CREATE FUNCTION rls_test.write_as(_uid uuid, _aal text, _sql text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  BEGIN
    PERFORM rls_test.login(_uid, _aal);
    EXECUTE _sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'RLSRB';  -- annulla la modifica
  EXCEPTION
    WHEN SQLSTATE 'RLSRB' THEN NULL;
    WHEN OTHERS THEN n := NULL;
  END;
  PERFORM rls_test.logout();
  RETURN n;
END $$;

CREATE FUNCTION rls_test.fail(_msg text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO rls_test.failures VALUES (_msg)
$$;

CREATE FUNCTION rls_test.count_check() RETURNS void LANGUAGE sql AS $$
  UPDATE rls_test.stats SET checks = checks + 1
$$;

-- Si aspetta che _sql (eseguita come _persona) restituisca _expected.
CREATE FUNCTION rls_test.expect(_persona text, _what text, _sql text, _expected int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p rls_test.personas; n int;
BEGIN
  SELECT * INTO p FROM rls_test.personas WHERE name = _persona;
  n := rls_test.scalar_as(p.uid, p.aal, _sql);
  PERFORM rls_test.count_check();
  IF n IS DISTINCT FROM _expected THEN
    PERFORM rls_test.fail(format('%s: %s → attese %s righe, trovate %s', _persona, _what, _expected, n));
  END IF;
END $$;

-- Si aspetta che la modifica _sql (eseguita come _persona) non tocchi nulla.
CREATE FUNCTION rls_test.expect_blocked(_persona text, _what text, _sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p rls_test.personas; n int;
BEGIN
  SELECT * INTO p FROM rls_test.personas WHERE name = _persona;
  n := rls_test.write_as(p.uid, p.aal, _sql);
  PERFORM rls_test.count_check();
  IF coalesce(n, 0) > 0 THEN
    PERFORM rls_test.fail(format('%s: %s → riuscito (%s righe), doveva essere bloccato', _persona, _what, n));
  END IF;
END $$;

-- ── 0. Ogni tabella con dati personali ha dati di prova ────────────────────
DO $$
DECLARE t record; n int;
BEGIN
  FOR t IN SELECT * FROM rls_test.tables WHERE NOT shared ORDER BY tbl LOOP
    IF t.subject_col IS NOT NULL OR t.group_col IS NOT NULL THEN
      SELECT count(DISTINCT coalesce(subject, grp)) INTO n FROM rls_test.row_scope WHERE tbl = t.tbl;
      IF n < 2 THEN
        PERFORM rls_test.fail(format(
          'tabella %s: servono righe di almeno due persone/gruppi in supabase/tests/rls/01_seed.sql (ora %s)', t.tbl, n));
      END IF;
    ELSE
      SELECT count(*) INTO n FROM rls_test.row_scope WHERE tbl = t.tbl;
      IF n = 0 THEN
        PERFORM rls_test.fail(format(
          'tabella %s: nessuna riga di prova in supabase/tests/rls/01_seed.sql (o aggiungila a shared_tables se è un contenuto pubblico)', t.tbl));
      END IF;
    END IF;
    PERFORM rls_test.count_check();
  END LOOP;
END $$;

-- ── 1 e 2. Lettura e modifica, per ogni persona e ogni tabella ─────────────
DO $$
DECLARE
  p rls_test.personas; t record;
  visible tid[]; forbidden tid[]; leaked int; n int; col text;
BEGIN
  FOR p IN SELECT * FROM rls_test.personas ORDER BY name LOOP
    FOR t IN SELECT * FROM rls_test.tables WHERE NOT shared ORDER BY tbl LOOP
      -- Lettura
      BEGIN
        PERFORM rls_test.login(p.uid, p.aal);
        EXECUTE format('SELECT coalesce(array_agg(ctid), ''{}'') FROM public.%I', t.tbl) INTO visible;
        PERFORM rls_test.logout();
      EXCEPTION WHEN insufficient_privilege THEN
        PERFORM rls_test.logout();
        visible := '{}';
      END;
      SELECT count(*) INTO leaked FROM rls_test.row_scope r
      WHERE r.tbl = t.tbl AND r.rid = ANY (visible)
        AND NOT rls_test.allowed(p.name, t.tbl, r.subject, r.grp, r.course);
      PERFORM rls_test.count_check();
      IF leaked > 0 THEN
        PERFORM rls_test.fail(format('%s vede %s righe altrui in %s', p.name, leaked, t.tbl));
      END IF;

      -- Modifica e cancellazione delle righe altrui
      SELECT coalesce(array_agg(r.rid), '{}') INTO forbidden FROM rls_test.row_scope r
      WHERE r.tbl = t.tbl AND NOT rls_test.allowed(p.name, t.tbl, r.subject, r.grp, r.course);
      CONTINUE WHEN cardinality(forbidden) = 0;

      col := coalesce(t.subject_col, t.group_col, (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.tbl AND is_generated = 'NEVER' AND is_identity = 'NO'
        ORDER BY ordinal_position LIMIT 1));
      n := rls_test.write_as(p.uid, p.aal, format(
        'UPDATE public.%I SET %I = %I WHERE ctid = ANY (%L::tid[])', t.tbl, col, col, forbidden));
      PERFORM rls_test.count_check();
      IF coalesce(n, 0) > 0 THEN
        PERFORM rls_test.fail(format('%s può modificare %s righe altrui in %s', p.name, n, t.tbl));
      END IF;
      n := rls_test.write_as(p.uid, p.aal, format(
        'DELETE FROM public.%I WHERE ctid = ANY (%L::tid[])', t.tbl, forbidden));
      PERFORM rls_test.count_check();
      IF coalesce(n, 0) > 0 THEN
        PERFORM rls_test.fail(format('%s può cancellare %s righe altrui in %s', p.name, n, t.tbl));
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── 3. Tentativi espliciti di scalata ──────────────────────────────────────
SELECT rls_test.expect_blocked('alunno S1', 'darsi il ruolo admin',
  $$INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000101', 'admin')$$);
SELECT rls_test.expect_blocked('alunno S1', 'darsi il ruolo insegnante',
  $$INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000101', 'teacher')$$);
SELECT rls_test.expect_blocked('alunno S1', 'diventare genitore',
  $$UPDATE public.profiles SET role = 'parent' WHERE id = '00000000-0000-0000-0000-000000000101'$$);
SELECT rls_test.expect_blocked('alunno S1', 'cambiarsi il saldo lezioni',
  $$UPDATE public.profiles SET lesson_balance = 999 WHERE id = '00000000-0000-0000-0000-000000000101'$$);
SELECT rls_test.expect_blocked('alunno S1', 'iscriversi al gruppo G2',
  $$INSERT INTO public.group_students (group_id, student_id) VALUES ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000101')$$);
SELECT rls_test.expect_blocked('alunno S1', 'consegnare un compito a nome di S3',
  $$INSERT INTO public.homework_submissions (student_id, homework_id) VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000d001')$$);
SELECT rls_test.expect_blocked('alunno S1', 'salvare codice a nome di S3',
  $$INSERT INTO public.student_code_drafts (student_id, task_id, code_type) VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000f001', 'python')$$);
SELECT rls_test.expect_blocked('genitore P1', 'collegarsi come genitore di S3',
  $$UPDATE public.profiles SET parent_id = '00000000-0000-0000-0000-000000000201' WHERE id = '00000000-0000-0000-0000-000000000103'$$);
SELECT rls_test.expect_blocked('genitore P1', 'farsi secondo genitore di S3',
  $$INSERT INTO public.student_guardians (student_id, guardian_id) VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000201')$$);
SELECT rls_test.expect_blocked('genitore P1', 'collegare S1 a sé con la funzione dell''admin',
  $$SELECT public.admin_set_parent_children('00000000-0000-0000-0000-000000000201', ARRAY['00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000103']::uuid[])$$);
SELECT rls_test.expect_blocked('genitore P3', 'diventare genitore principale di S2',
  $$UPDATE public.profiles SET parent_id = '00000000-0000-0000-0000-000000000203' WHERE id = '00000000-0000-0000-0000-000000000102'$$);
SELECT rls_test.expect_blocked('genitore P1', 'dare il consenso media per S3',
  $$INSERT INTO public.media_consents (student_id, purpose, granted) VALUES ('00000000-0000-0000-0000-000000000103', 'open_day', true)$$);
-- Consenso AI: si scrive solo con set_ai_consent / set_student_birth_year (11_ai_consent.sql)
SELECT rls_test.expect_blocked('genitore P1', 'scrivere il consenso AI di S2 senza la funzione',
  $$INSERT INTO public.ai_consents (student_id, granted, version, decided_as) VALUES ('00000000-0000-0000-0000-000000000102', true, 'test-ai-1', 'parent')$$);
SELECT rls_test.expect_blocked('alunno S1', 'riattivarsi il consenso AI senza la funzione',
  $$UPDATE public.ai_consents SET granted = true WHERE student_id = '00000000-0000-0000-0000-000000000101'$$);
SELECT rls_test.expect_blocked('alunno S2', 'cambiarsi l''anno di nascita',
  $$UPDATE public.student_birth_years SET birth_year = 2000 WHERE student_id = '00000000-0000-0000-0000-000000000102'$$);
SELECT rls_test.expect_blocked('alunno S1', 'pubblicare una versione dell''informativa AI',
  $$INSERT INTO public.ai_consent_versions (version, published_at) VALUES ('finta', current_date)$$);
SELECT rls_test.expect_blocked('genitore P1', 'iscrivere il figlio S1 al gruppo G2',
  $$INSERT INTO public.group_students (group_id, student_id) VALUES ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000101')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'prendersi il gruppo G2',
  $$UPDATE public.student_groups SET teacher_id = '00000000-0000-0000-0000-000000000301' WHERE id = '00000000-0000-0000-0000-00000000a002'$$);
SELECT rls_test.expect_blocked('insegnante T1', 'aggiungere un alunno al proprio gruppo',
  $$INSERT INTO public.group_students (group_id, student_id) VALUES ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000104')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'commentare l''alunno S2 (non suo)',
  $$INSERT INTO public.student_comments (student_id, author_id, content) VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000301', 'x')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'scrivere note sul gruppo G2',
  $$INSERT INTO public.group_comments (group_id, author_id, content) VALUES ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000301', 'x')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'segnare presenze nel gruppo G2',
  $$INSERT INTO public.group_attendance (group_id, student_id, lesson_number) VALUES ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000102', 7)$$);
SELECT rls_test.expect_blocked('insegnante T1', 'scrivere il report di una lezione di G2',
  $$INSERT INTO public.lesson_reports (group_id, lesson_number, teacher_id) VALUES ('00000000-0000-0000-0000-00000000a002', 7, '00000000-0000-0000-0000-000000000301')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'darsi il ruolo admin',
  $$INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000301', 'admin')$$);

-- ── 4. Ognuno vede davvero i propri dati ───────────────────────────────────
SELECT rls_test.expect('alunno S1', 'il proprio profilo', 'SELECT count(*) FROM public.profiles', 1);
SELECT rls_test.expect('alunno S1', 'le proprie iscrizioni', 'SELECT count(*) FROM public.enrollments', 1);
SELECT rls_test.expect('alunno S1', 'i propri compiti consegnati', 'SELECT count(*) FROM public.homework_submissions', 1);
SELECT rls_test.expect('alunno S1', 'il proprio gruppo', 'SELECT count(*) FROM public.student_groups', 1);
SELECT rls_test.expect('alunno S1', 'i commenti a lui visibili', 'SELECT count(*) FROM public.student_comments', 1);
SELECT rls_test.expect('alunno S3', 'i propri due gruppi', 'SELECT count(*) FROM public.student_groups', 2);
SELECT rls_test.expect('genitore P1', 'sé stesso e i due figli', 'SELECT count(*) FROM public.profiles', 3);
SELECT rls_test.expect('genitore P1', 'i compiti dei figli', 'SELECT count(*) FROM public.homework_submissions', 2);
SELECT rls_test.expect('genitore P1', 'i commenti per i genitori (non quelli solo-docenti)', 'SELECT count(*) FROM public.student_comments', 2);
SELECT rls_test.expect('genitore P1', 'i gruppi dei figli', 'SELECT count(*) FROM public.student_groups', 2);
-- Sondaggio di soddisfazione: lo vede solo chi deve rispondere (il genitore), non l'alunno
SELECT rls_test.expect('genitore P1', 'il sondaggio di soddisfazione di S1', 'SELECT count(*) FROM public.satisfaction_surveys', 1);
SELECT rls_test.expect('alunno S1', 'nessun sondaggio (risponde il genitore)', 'SELECT count(*) FROM public.satisfaction_surveys', 0);
SELECT rls_test.expect_blocked('genitore P1', 'rispondere al sondaggio senza la edge function',
  'UPDATE public.satisfaction_surveys SET score = 0');
DO $$
BEGIN
  IF to_regclass('public.media_consents') IS NOT NULL THEN
    PERFORM rls_test.expect('genitore P1', 'i consensi media dei figli', 'SELECT count(*) FROM public.media_consents', 2);
  END IF;
END $$;
SELECT rls_test.expect('genitore P1', 'gli anni di nascita dei figli', 'SELECT count(*) FROM public.student_birth_years', 2);
SELECT rls_test.expect('genitore P1', 'il consenso AI dei figli (solo S1)', 'SELECT count(*) FROM public.ai_consents', 1);
SELECT rls_test.expect('genitore P2', 'il consenso AI del figlio S3', 'SELECT count(*) FROM public.ai_consents', 1);
-- Secondo genitore (student_guardians): vede i figli come il genitore principale
SELECT rls_test.expect('genitore P3', 'sé stesso e i figli S2 e S3 (secondo genitore)', 'SELECT count(*) FROM public.profiles', 3);
SELECT rls_test.expect('genitore P3', 'i gruppi di S2 e S3', 'SELECT count(*) FROM public.student_groups', 2);
SELECT rls_test.expect('genitore P3', 'l''anno di nascita di S2 (S3 non ce l''ha)', 'SELECT count(*) FROM public.student_birth_years', 1);
SELECT rls_test.expect('genitore P3', 'il consenso AI di S3 dato da P2', 'SELECT count(*) FROM public.ai_consents', 1);
SELECT rls_test.expect('genitore P3', 'i propri collegamenti da secondo genitore', 'SELECT count(*) FROM public.student_guardians', 2);
SELECT rls_test.expect('genitore P1', 'il secondo genitore di S2', 'SELECT count(*) FROM public.student_guardians', 1);
SELECT rls_test.expect('alunno S1', 'il proprio consenso AI e il suo storico', 'SELECT count(*) FROM public.ai_consent_events', 1);
SELECT rls_test.expect('insegnante T1', 'il proprio gruppo', 'SELECT count(*) FROM public.student_groups WHERE teacher_id = auth.uid()', 1);
SELECT rls_test.expect('insegnante T1', 'gli alunni del proprio gruppo', $$SELECT count(*) FROM public.group_students WHERE group_id = '00000000-0000-0000-0000-00000000a001'$$, 2);
SELECT rls_test.expect('insegnante T1', 'i profili dei propri alunni', $$SELECT count(*) FROM public.profiles WHERE id <> auth.uid()$$, 2);
SELECT rls_test.expect('insegnante T1', 'i compiti del proprio corso', $$SELECT count(*) FROM public.homework_submissions WHERE homework_id = '00000000-0000-0000-0000-00000000d001'$$, 2);
SELECT rls_test.expect('insegnante T1', 'le presenze del proprio gruppo', 'SELECT count(*) FROM public.group_attendance', 2);

-- L'insegnante T1 può valutare i compiti del proprio corso (anche di S3, che
-- è pure nel gruppo di T2), ma non quelli del corso di T2.
DO $$
DECLARE n int;
BEGIN
  n := rls_test.write_as('00000000-0000-0000-0000-000000000301', 'aal2',
    $q$UPDATE public.homework_submissions SET grade = 90
       WHERE student_id = '00000000-0000-0000-0000-000000000103' AND homework_id = '00000000-0000-0000-0000-00000000d001'$q$);
  PERFORM rls_test.count_check();
  IF n IS DISTINCT FROM 1 THEN
    PERFORM rls_test.fail(format('insegnante T1 non riesce a valutare il compito di S3 nel proprio corso (righe: %s)', n));
  END IF;
END $$;
SELECT rls_test.expect_blocked('insegnante T1', 'valutare il compito di S3 nel corso di T2',
  $$UPDATE public.homework_submissions SET grade = 90
    WHERE student_id = '00000000-0000-0000-0000-000000000103' AND homework_id = '00000000-0000-0000-0000-00000000d002'$$);
SELECT rls_test.expect('insegnante T1', 'il profilo di S3 (alunno condiviso con T2)',
  $$SELECT count(*) FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000103'$$, 1);
SELECT rls_test.expect('insegnante T1', 'solo l''iscrizione di S3 al proprio corso',
  $$SELECT count(*) FROM public.enrollments WHERE student_id = '00000000-0000-0000-0000-000000000103'$$, 1);

-- Proposte del corso successivo: il genitore vede solo quelle inviate, non le
-- bozze; l'insegnante scrive bozze solo per i propri gruppi, non sceglie lo
-- sconto e non le invia; la famiglia risponde solo tramite la edge function.
SELECT rls_test.expect('genitore P1', 'la proposta inviata per S1 ma non la bozza di S2',
  'SELECT count(*) FROM public.course_proposals', 1);
SELECT rls_test.expect('insegnante T2', 'le proposte del proprio gruppo (anche bozze)',
  'SELECT count(*) FROM public.course_proposals', 2);
SELECT rls_test.expect('insegnante T1', 'solo le proposte del proprio gruppo',
  'SELECT count(*) FROM public.course_proposals', 1);
SELECT rls_test.expect_blocked('genitore P1', 'accettare da sé la proposta di S1',
  $$UPDATE public.course_proposals SET status = 'accepted' WHERE student_id = '00000000-0000-0000-0000-000000000101'$$);
SELECT rls_test.expect_blocked('insegnante T2', 'inviare da sé la bozza di S2',
  $$UPDATE public.course_proposals SET status = 'sent', offer_expires_on = current_date + 5 WHERE student_id = '00000000-0000-0000-0000-000000000102'$$);
SELECT rls_test.expect_blocked('insegnante T1', 'scrivere una proposta per S2 nel gruppo di T2',
  $$INSERT INTO public.course_proposals (student_id, group_id, proposed_course_id, teacher_reason, created_by)
    VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c001',
            'Tentativo su un gruppo altrui', '00000000-0000-0000-0000-000000000301')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'scrivere una proposta già inviata',
  $$INSERT INTO public.course_proposals (student_id, group_id, proposed_course_id, teacher_reason, created_by, status, offer_expires_on)
    VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002',
            'Tentativo di saltare la segreteria', '00000000-0000-0000-0000-000000000301', 'sent', current_date + 5)$$);
DO $$
DECLARE n int; cents int;
BEGIN
  -- La bozza dell'insegnante passa, ma lo sconto resta quello di default
  PERFORM rls_test.login('00000000-0000-0000-0000-000000000302', 'aal2');
  UPDATE public.course_proposals SET teacher_reason = 'Motivo corretto dall''insegnante', discount_cents = 99900
  WHERE student_id = '00000000-0000-0000-0000-000000000102' AND status = 'draft';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM rls_test.logout();
  SELECT discount_cents INTO cents FROM public.course_proposals
  WHERE student_id = '00000000-0000-0000-0000-000000000102' AND status = 'draft';
  PERFORM rls_test.count_check();
  IF n IS DISTINCT FROM 1 THEN
    PERFORM rls_test.fail(format('insegnante T2 non riesce a correggere la bozza di S2 (righe: %s)', n));
  ELSIF cents IS DISTINCT FROM 5000 THEN
    PERFORM rls_test.fail(format('insegnante T2 ha cambiato lo sconto della bozza di S2 (%s)', cents));
  END IF;
END $$;

-- Attestati di fine corso: ognuno vede solo i propri (o dei figli, o dei
-- propri gruppi); nessuno li scrive a mano, li crea release_group_certificates()
SELECT rls_test.expect('genitore P1', 'l''attestato di S1 ma non di S2 (non sbloccato)',
  'SELECT count(*) FROM public.course_certificates', 1);
SELECT rls_test.expect('genitore P2', 'l''attestato di S3', 'SELECT count(*) FROM public.course_certificates', 1);
SELECT rls_test.expect('alunno S1', 'il proprio attestato', 'SELECT count(*) FROM public.course_certificates', 1);
SELECT rls_test.expect('alunno S2', 'nessun attestato', 'SELECT count(*) FROM public.course_certificates', 0);
SELECT rls_test.expect('insegnante T1', 'solo gli attestati del proprio gruppo', 'SELECT count(*) FROM public.course_certificates', 1);
SELECT rls_test.expect_blocked('genitore P1', 'creare da sé l''attestato di S2',
  $$INSERT INTO public.course_certificates (student_id, group_id, student_name, course_title, teacher_name,
      lessons_attended, lessons_total, hours_attended, issued_on, code)
    VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000a002', 'Alunno S2', 'Corso C2', 'X',
      32, 32, 48, current_date, 'TL-FAKE-1')$$);
SELECT rls_test.expect_blocked('insegnante T1', 'ritoccare le presenze sull''attestato di S1',
  $$UPDATE public.course_certificates SET lessons_attended = 32 WHERE student_id = '00000000-0000-0000-0000-000000000101'$$);

-- Senza verifica in due passaggi (aal1) un insegnante non vede nulla.
DO $$
BEGIN
  PERFORM rls_test.count_check();
  IF coalesce(rls_test.scalar_as('00000000-0000-0000-0000-000000000301', 'aal1', 'SELECT count(*) FROM public.group_students'), 0) <> 0 THEN
    PERFORM rls_test.fail('insegnante T1 senza 2FA vede gli alunni: il controllo mfa_required non funziona');
  END IF;
END $$;

-- L'admin (con 2FA) vede tutte le righe di prova: conferma che i dati ci sono.
DO $$
DECLARE t record; n int; total int;
BEGIN
  FOR t IN SELECT * FROM rls_test.tables WHERE NOT shared AND tbl IN
           ('profiles', 'group_students', 'homework_submissions', 'student_comments', 'crm_leads', 'trial_bookings') LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.tbl) INTO total;
    n := rls_test.scalar_as('00000000-0000-0000-0000-000000000901', 'aal2', format('SELECT count(*) FROM public.%I', t.tbl));
    PERFORM rls_test.count_check();
    IF n IS DISTINCT FROM total THEN
      PERFORM rls_test.fail(format('admin vede %s righe su %s in %s', n, total, t.tbl));
    END IF;
  END LOOP;
END $$;

-- ── Problemi noti ──────────────────────────────────────────────────────────
-- Falle già scoperte e non ancora corrette: vengono mostrate come avvisi ma
-- non fanno fallire il test, così ogni NUOVA falla salta subito all'occhio.
-- Quando la correzione arriva, togli la riga corrispondente: se resta qui ma
-- la falla non c'è più, il test fallisce per ricordartelo.
CREATE TABLE rls_test.known_issues (msg text PRIMARY KEY, note text NOT NULL);
-- Esempio:
-- INSERT INTO rls_test.known_issues VALUES
--   ('insegnante T1 vede 1 righe altrui in enrollments', 'motivo e link alla correzione');

-- ── Esito ──────────────────────────────────────────────────────────────────
DO $$
DECLARE f record; n int; total int;
BEGIN
  FOR f IN SELECT k.msg, k.note FROM rls_test.known_issues k
           WHERE EXISTS (SELECT 1 FROM rls_test.failures x WHERE x.msg = k.msg) ORDER BY k.msg LOOP
    RAISE NOTICE '⚠ noto: % (%)', f.msg, f.note;
  END LOOP;
  INSERT INTO rls_test.failures
  SELECT format('il problema noto "%s" non si presenta più: toglilo da known_issues in 02_checks.sql', k.msg)
  FROM rls_test.known_issues k WHERE NOT EXISTS (SELECT 1 FROM rls_test.failures x WHERE x.msg = k.msg);
  DELETE FROM rls_test.failures x WHERE EXISTS (SELECT 1 FROM rls_test.known_issues k WHERE k.msg = x.msg);

  SELECT count(*) INTO n FROM rls_test.failures;
  SELECT checks INTO total FROM rls_test.stats;
  FOR f IN SELECT msg FROM rls_test.failures ORDER BY msg LOOP
    RAISE NOTICE '✗ %', f.msg;
  END LOOP;
  IF n > 0 THEN
    RAISE EXCEPTION '% controlli su % falliti', n, total;
  END IF;
  RAISE NOTICE '% controlli superati (% persone, % tabelle, % problemi noti)', total,
    (SELECT count(*) FROM rls_test.personas), (SELECT count(*) FROM rls_test.tables),
    (SELECT count(*) FROM rls_test.known_issues);
END $$;

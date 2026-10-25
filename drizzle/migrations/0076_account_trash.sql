-- Account eliminati nel Cestino per 30 giorni (Admin → Cestino).
--
-- Con 0069 eliminare un account restava definitivo. Ora il genitore che si
-- elimina da Profilo (delete-my-account, insieme ai figli) e l'admin che
-- elimina un utente da Utenti (admin-set-password, action "delete") chiamano
-- trash_account():
--   - il login resta in auth.users ma bloccato (banned_until): quando torna ha
--     la stessa email, la stessa password, gli stessi ruoli e consensi;
--   - il profilo si cancella come prima e tutto quello che gli va dietro a
--     cascata (iscrizioni, progressi, consegne, presenze, badge… e i profili
--     dei figli) finisce in un solo batch del cestino;
--   - i file nello storage restano dove sono.
-- restore_trash_batch rimette le righe e sblocca il login: l'account torna
-- com'era. Dopo 30 giorni, o con "Elimina per sempre", la edge function
-- purge-deleted-accounts chiama purge_account_trash(), che cancella il login,
-- e poi cancella i file: da lì l'eliminazione è definitiva come prima.
--
-- Le tabelle raggiunte solo dai profili hanno il trigger del cestino con
-- l'argomento 'account_only': catturano solo dentro trash_account(), così un
-- profilo cancellato in altro modo non lascia nel cestino righe che non si
-- potrebbero ripristinare (il login non ci sarebbe più).

-- ── Account nel cestino ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_trash (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  -- Blocco del login che c'era prima del cestino, rimesso al ripristino
  previous_banned_until timestamptz,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_trash_batch ON public.account_trash (batch_id);
CREATE INDEX IF NOT EXISTS idx_account_trash_deleted_at ON public.account_trash (deleted_at);

ALTER TABLE public.account_trash ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_trash FROM anon, authenticated;
GRANT SELECT ON public.account_trash TO authenticated;
GRANT ALL ON public.account_trash TO service_role;

DROP POLICY IF EXISTS "Admins can view account trash" ON public.account_trash;
CREATE POLICY "Admins can view account trash"
ON public.account_trash FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ── Cattura ────────────────────────────────────────────────────────────────
-- Come 0069, più l'argomento 'account_only' (sempre il primo).
CREATE OR REPLACE FUNCTION public.trash_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _state text;
  _batch text;
  _old jsonb;
  _links jsonb := '[]'::jsonb;
  _spec text[];
  _ids jsonb;
  i int;
BEGIN
  IF TG_NARGS > 0 AND TG_ARGV[0] = 'account_only'
     AND coalesce(current_setting('techland.account_trash', true), '') <> 'on' THEN
    RETURN OLD;
  END IF;

  -- Una decisione per transazione e per utente: o un batch nuovo o 'skip'
  _state := current_setting('techland.trash_batch', true);
  IF _state IS NULL OR _state = '' OR split_part(_state, '/', 1) <> coalesce(_uid::text, '') THEN
    _batch := CASE
      WHEN _uid IS NOT NULL AND public.has_role(_uid, 'admin') THEN gen_random_uuid()::text
      ELSE 'skip'
    END;
    PERFORM set_config('techland.trash_batch', coalesce(_uid::text, '') || '/' || _batch, true);
  ELSE
    _batch := split_part(_state, '/', 2);
  END IF;

  IF _batch = 'skip' THEN
    RETURN OLD;
  END IF;

  _old := to_jsonb(OLD);
  FOR i IN 0 .. TG_NARGS - 1 LOOP
    CONTINUE WHEN TG_ARGV[i] = 'account_only';
    _spec := string_to_array(TG_ARGV[i], '|');
    BEGIN
      EXECUTE format('SELECT jsonb_agg(r.id) FROM public.%I r WHERE r.%I = ($1).%I',
                     _spec[1], _spec[2], _spec[3])
        INTO _ids USING OLD;
      IF _ids IS NOT NULL THEN
        _links := _links || jsonb_build_object(
          'table', _spec[1], 'column', _spec[2], 'value', _old -> _spec[3], 'ids', _ids);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Un collegamento non letto non deve bloccare l'eliminazione
      RAISE WARNING 'trash_capture: collegamento % non letto: %', TG_ARGV[i], SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.trash_items (batch_id, table_name, row_data, links, deleted_by)
  VALUES (_batch::uuid, TG_TABLE_NAME, _old, NULLIF(_links, '[]'::jsonb), _uid);

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_capture() FROM PUBLIC, anon, authenticated;

-- Come 0069, più i profili e le loro figlie a cascata. Una tabella raggiunta
-- solo dai profili ha il trigger 'account_only'; una raggiunta anche dalle
-- tabelle che l'admin cancella dall'app cattura sempre, come prima.
CREATE OR REPLACE FUNCTION public.ensure_trash_triggers()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _roots constant text[] := ARRAY[
    -- Contenuti dei corsi
    'courses', 'lessons', 'lesson_tasks', 'homework', 'seasonal_themes',
    -- Gruppi, calendario e iscrizioni
    'student_groups', 'group_students', 'group_attendance', 'group_lesson_schedule',
    'scheduled_lessons', 'enrollments', 'teacher_courses', 'lesson_balance_log',
    'teacher_background_checks', 'student_comments',
    -- Richieste, contatti e CRM
    'trial_bookings', 'contact_submissions', 'job_applications', 'newsletter_subscribers',
    'referrals', 'crm_leads', 'crm_payments',
    -- Sito
    'blog_posts', 'glossary_terms', 'landing_pages', 'school_closures', 'teacher_links',
    'push_templates'
  ];
  -- Solo dentro trash_account()
  _account_roots constant text[] := ARRAY['profiles'];
  -- Ruoli, login e cestino non passano dal cestino
  _never constant text[] := ARRAY['user_roles', 'trash_items', 'account_trash'];
  t record;
  _args text;
BEGIN
  FOR t IN
    WITH RECURSIVE scope(rel, account_only) AS (
      SELECT c.oid, c.relname = ANY (_account_roots)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        AND c.relname = ANY (_roots || _account_roots)
      UNION
      SELECT con.conrelid, s.account_only
      FROM pg_constraint con JOIN scope s ON con.confrelid = s.rel
      WHERE con.contype = 'f' AND con.confdeltype = 'c'
    )
    SELECT c.oid, c.relname, bool_and(s.account_only) AS account_only
    FROM scope s
    JOIN pg_class c ON c.oid = s.rel
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT (c.relname = ANY (_never))
    GROUP BY c.oid, c.relname
    ORDER BY c.relname
  LOOP
    SELECT string_agg(quote_literal(spec), ', ' ORDER BY spec) INTO _args
    FROM (
      SELECT format('%s|%s|%s', r.relname, ra.attname, pa.attname) AS spec
      FROM pg_constraint con
      JOIN pg_class r ON r.oid = con.conrelid
      JOIN pg_namespace rn ON rn.oid = r.relnamespace AND rn.nspname = 'public'
      JOIN pg_attribute ra ON ra.attrelid = con.conrelid AND ra.attnum = con.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND con.confrelid = t.oid AND con.confdeltype = 'n'
        AND cardinality(con.conkey) = 1
        AND NOT (r.relname = ANY (_never))
        AND EXISTS (SELECT 1 FROM pg_attribute ia
                    WHERE ia.attrelid = con.conrelid AND ia.attname = 'id' AND NOT ia.attisdropped)
      UNION
      -- Cancellando una lezione i suoi compiti stagionali tornano in archivio
      -- (seasonal_homework_unlink_lesson): al ripristino tornano nella lezione.
      SELECT 'homework|lesson_id|id' WHERE t.relname = 'lessons'
    ) specs;

    IF t.account_only THEN
      _args := concat_ws(', ', quote_literal('account_only'), _args);
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS a_trash_capture ON public.%I', t.relname);
    EXECUTE format(
      'CREATE TRIGGER a_trash_capture BEFORE DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.trash_capture(%s)',
      t.relname, coalesce(_args, ''));
    RETURN NEXT t.relname;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_trash_triggers() FROM PUBLIC, anon, authenticated;

-- ── Profili cancellati ─────────────────────────────────────────────────────
-- Dentro trash_account() il login resta (bloccato) e i dati restano nel
-- cestino: questi due trigger di 0069 e 20260605215219 non fanno niente.
CREATE OR REPLACE FUNCTION public.trash_forget_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(current_setting('techland.account_trash', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  DELETE FROM public.trash_items t
  WHERE EXISTS (SELECT 1 FROM jsonb_each_text(t.row_data) e WHERE e.value = OLD.id::text);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_forget_profile() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF coalesce(current_setting('techland.account_trash', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  -- Safe even if auth.users row is already gone (cascade source): WHERE matches nothing.
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- ── Eliminazione nel cestino ───────────────────────────────────────────────
-- L'account e, per un genitore, i figli (profiles.parent_id è ON DELETE
-- CASCADE): login bloccati, profili e figlie in un batch. _by è chi elimina
-- (il genitore stesso o l'admin): il service role non ha auth.uid().
-- Errori: account_not_found (nessun profilo con quell'id).
CREATE OR REPLACE FUNCTION public.trash_account(_user uuid, _by uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _batch uuid := gen_random_uuid();
  _users uuid[];
BEGIN
  WITH RECURSIVE family(id) AS (
    SELECT p.id FROM public.profiles p WHERE p.id = _user
    UNION
    SELECT p.id FROM public.profiles p JOIN family f ON p.parent_id = f.id
  )
  SELECT array_agg(id) INTO _users FROM family;
  IF _users IS NULL THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('techland.trash_batch', coalesce(auth.uid()::text, '') || '/' || _batch::text, true);
  PERFORM set_config('techland.account_trash', 'on', true);

  INSERT INTO public.account_trash (user_id, batch_id, previous_banned_until, deleted_by)
  SELECT u.id, _batch, u.banned_until, _by
  FROM auth.users u
  WHERE u.id = ANY (_users);

  -- GoTrue rifiuta login e rinnovo della sessione finché banned_until è nel futuro
  UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = ANY (_users);

  -- Prima riga del batch = il profilo dell'account (la "radice" in trash_batches)
  DELETE FROM public.profiles WHERE id = _user;

  UPDATE public.trash_items SET deleted_by = _by WHERE batch_id = _batch;

  PERFORM set_config('techland.account_trash', '', true);
  PERFORM set_config('techland.trash_batch', '', true);
  RETURN _batch;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trash_account(uuid, uuid) TO service_role;

-- ── Ripristino ─────────────────────────────────────────────────────────────
-- Come 0069; in fondo, per un account, sblocca il login.
CREATE OR REPLACE FUNCTION public.restore_trash_batch(_batch uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _tables text[];
  _table text;
  _trg record;
  _disabled text[] := '{}';
  _entry text;
  _pending bigint[];
  _retry bigint[];
  _id bigint;
  _item public.trash_items;
  _cols text;
  _restored int := 0;
  _link jsonb;
  _leads uuid[];
  _groups uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un admin con la verifica in due passaggi può ripristinare dal cestino'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.trash_items WHERE batch_id = _batch FOR UPDATE;
  SELECT array_agg(DISTINCT table_name) INTO _tables FROM public.trash_items WHERE batch_id = _batch;
  IF _tables IS NULL THEN
    RAISE EXCEPTION 'trash_not_found' USING ERRCODE = 'P0002';
  END IF;
  FOREACH _table IN ARRAY _tables LOOP
    IF to_regclass(format('public.%I', _table)) IS NULL THEN
      RAISE EXCEPTION 'trash_table_missing' USING ERRCODE = '42P01', DETAIL = _table;
    END IF;
  END LOOP;

  -- Trigger utente spenti solo per questa transazione (ALTER TABLE è
  -- transazionale: se qualcosa va storto tornano accesi col rollback).
  -- I vincoli di chiave esterna restano attivi.
  FOR _trg IN
    SELECT c.relname, t.tgname, t.tgenabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (_tables)
      AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', _trg.relname, _trg.tgname);
    _disabled := _disabled || format('%s|%s|%s', _trg.relname, _trg.tgname, _trg.tgenabled);
  END LOOP;

  -- Di solito l'ordine di cancellazione va già bene (prima il genitore, poi le
  -- figlie). Se una riga dipende da un'altra non ancora reinserita, riprova
  -- al giro dopo; se un giro non reinserisce niente, manca davvero qualcosa.
  SELECT array_agg(id ORDER BY id) INTO _pending FROM public.trash_items WHERE batch_id = _batch;
  LOOP
    _retry := '{}';
    FOREACH _id IN ARRAY _pending LOOP
      SELECT * INTO _item FROM public.trash_items WHERE id = _id;
      SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO _cols
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', _item.table_name)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
        AND _item.row_data ? a.attname;
      BEGIN
        EXECUTE format(
          'INSERT INTO public.%1$I (%2$s) OVERRIDING SYSTEM VALUE '
          'SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)',
          _item.table_name, _cols)
          USING _item.row_data;
        _restored := _restored + 1;
      EXCEPTION
        WHEN foreign_key_violation THEN
          _retry := _retry || _id;
        WHEN unique_violation THEN
          RAISE EXCEPTION 'trash_conflict' USING ERRCODE = '23505',
            DETAIL = _item.table_name, HINT = coalesce(public.trash_row_label(_item.row_data), '');
        WHEN OTHERS THEN
          RAISE EXCEPTION 'trash_failed: %', SQLERRM USING ERRCODE = 'P0001',
            DETAIL = _item.table_name, HINT = coalesce(public.trash_row_label(_item.row_data), '');
      END;
    END LOOP;
    EXIT WHEN cardinality(_retry) = 0;
    IF cardinality(_retry) = cardinality(_pending) THEN
      SELECT * INTO _item FROM public.trash_items WHERE id = _retry[1];
      RAISE EXCEPTION 'trash_missing_parent' USING ERRCODE = '23503',
        DETAIL = _item.table_name, HINT = coalesce(public.trash_row_label(_item.row_data), '');
    END IF;
    _pending := _retry;
  END LOOP;

  -- Ricollega le righe staccate, solo se nel frattempo nessuno le ha spostate
  FOR _item IN
    SELECT * FROM public.trash_items WHERE batch_id = _batch AND links IS NOT NULL ORDER BY id
  LOOP
    FOR _link IN SELECT value FROM jsonb_array_elements(_item.links) LOOP
      BEGIN
        EXECUTE format(
          'UPDATE public.%1$I SET %2$I = (jsonb_populate_record(NULL::public.%1$I, '
          'jsonb_build_object(%3$L, $1))).%2$I '
          'WHERE %2$I IS NULL AND id::text IN (SELECT jsonb_array_elements_text($2))',
          _link->>'table', _link->>'column', _link->>'column')
          USING _link->'value', _link->'ids';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'restore_trash_batch: collegamento % non ripristinato: %', _link, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  FOREACH _entry IN ARRAY _disabled LOOP
    EXECUTE format('ALTER TABLE public.%I %s TRIGGER %I',
      split_part(_entry, '|', 1),
      CASE split_part(_entry, '|', 3)
        WHEN 'A' THEN 'ENABLE ALWAYS'
        WHEN 'R' THEN 'ENABLE REPLICA'
        ELSE 'ENABLE'
      END,
      split_part(_entry, '|', 2));
  END LOOP;

  -- Derivati da aggiornare a trigger riaccesi.
  -- Valore cliente dei lead con pagamenti ripristinati.
  SELECT array_agg(DISTINCT (row_data->>'lead_id')::uuid) INTO _leads
  FROM public.trash_items
  WHERE batch_id = _batch AND table_name = 'crm_payments' AND row_data->>'lead_id' IS NOT NULL;
  IF _leads IS NOT NULL THEN
    UPDATE public.crm_leads l
       SET lifetime_value_cents = COALESCE((
         SELECT SUM(p.amount_cents) FROM public.crm_payments p
          WHERE p.lead_id = l.id AND p.status = 'paid'), 0)
     WHERE l.id = ANY (_leads);
  END IF;

  -- Lead ripristinati: la sincronizzazione Notion riapre la pagina archiviata
  -- all'eliminazione (sync-lead-to-notion la aggiorna con archived: false).
  UPDATE public.crm_leads l
     SET full_name = l.full_name
   WHERE l.id IN (SELECT (row_data->>'id')::uuid FROM public.trash_items
                  WHERE batch_id = _batch AND table_name = 'crm_leads');

  -- Calendario Google degli insegnanti dei gruppi tornati
  SELECT array_agg(DISTINCT g) INTO _groups
  FROM (
    SELECT (row_data->>'id')::uuid AS g FROM public.trash_items
     WHERE batch_id = _batch AND table_name = 'student_groups'
    UNION
    SELECT (row_data->>'group_id')::uuid FROM public.trash_items
     WHERE batch_id = _batch AND table_name = 'group_lesson_schedule'
  ) s
  WHERE g IS NOT NULL;
  IF _groups IS NOT NULL AND to_regprocedure('public.google_calendar_touch(uuid[])') IS NOT NULL THEN
    EXECUTE 'SELECT public.google_calendar_touch(ARRAY(
               SELECT DISTINCT teacher_id FROM public.student_groups
                WHERE id = ANY ($1) AND teacher_id IS NOT NULL))'
      USING _groups;
  END IF;

  -- Account: il login torna come prima del cestino
  UPDATE auth.users u
     SET banned_until = a.previous_banned_until
    FROM public.account_trash a
   WHERE a.batch_id = _batch AND u.id = a.user_id;
  DELETE FROM public.account_trash WHERE batch_id = _batch;

  DELETE FROM public.trash_items WHERE batch_id = _batch;
  RETURN _restored;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_trash_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_trash_batch(uuid) TO authenticated;

-- ── Eliminazione definitiva ────────────────────────────────────────────────
-- Un account si elimina per sempre solo da purge-deleted-accounts, che dopo
-- il login cancella anche i file: qui l'errore trash_account lo dice all'app.
CREATE OR REPLACE FUNCTION public.purge_trash_batch(_batch uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un admin con la verifica in due passaggi può svuotare il cestino'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_trash WHERE batch_id = _batch) THEN
    RAISE EXCEPTION 'trash_account' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.trash_items WHERE batch_id = _batch;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_trash_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_trash_batch(uuid) TO authenticated;

-- Svuota tutto tranne gli account (l'app li passa poi a purge-deleted-accounts)
CREATE OR REPLACE FUNCTION public.empty_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un admin con la verifica in due passaggi può svuotare il cestino'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.trash_items t
  WHERE NOT EXISTS (SELECT 1 FROM public.account_trash a WHERE a.batch_id = t.batch_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.empty_trash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empty_trash() TO authenticated;

-- Account eliminati per sempre: login (con ruoli, consensi, dispositivi…),
-- batch e ogni altra riga del cestino con i loro dati. Restituisce gli id,
-- di cui purge-deleted-accounts cancella poi i file.
-- Errori: trash_not_found (già ripristinato o eliminato).
CREATE OR REPLACE FUNCTION public.purge_account_trash(_batch uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _users uuid[];
BEGIN
  -- Stesso ordine dei lock di restore_trash_batch
  PERFORM 1 FROM public.trash_items WHERE batch_id = _batch FOR UPDATE;
  SELECT array_agg(user_id) INTO _users
  FROM (SELECT user_id FROM public.account_trash WHERE batch_id = _batch FOR UPDATE) a;
  IF _users IS NULL THEN
    RAISE EXCEPTION 'trash_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.trash_items WHERE batch_id = _batch;
  DELETE FROM public.trash_items t
  WHERE EXISTS (SELECT 1 FROM jsonb_each_text(t.row_data) e WHERE e.value = ANY (_users::text[]));
  -- account_trash segue a cascata
  DELETE FROM auth.users WHERE id = ANY (_users);
  RETURN _users;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_account_trash(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_trash(uuid) TO service_role;

-- ── Conservazione ──────────────────────────────────────────────────────────
-- Come 0069; gli account li elimina purge-deleted-accounts (anche i file).
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  analytics_deleted int;
  pageviews_deleted int;
  admin_deleted int;
  login_deleted int;
  security_deleted int;
  ratelimit_deleted int;
  email_deleted int;
  trash_deleted int;
BEGIN
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS analytics_deleted = ROW_COUNT;

  DELETE FROM public.page_views WHERE entered_at < now() - interval '30 days';
  GET DIAGNOSTICS pageviews_deleted = ROW_COUNT;

  DELETE FROM public.admin_access_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS admin_deleted = ROW_COUNT;

  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '7 days';
  GET DIAGNOSTICS login_deleted = ROW_COUNT;

  DELETE FROM public.security_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS security_deleted = ROW_COUNT;

  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS ratelimit_deleted = ROW_COUNT;

  DELETE FROM public.email_log WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS email_deleted = ROW_COUNT;

  DELETE FROM public.trash_items t
  WHERE t.deleted_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.account_trash a WHERE a.batch_id = t.batch_id);
  GET DIAGNOSTICS trash_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'analytics_events', analytics_deleted,
    'page_views', pageviews_deleted,
    'admin_access_logs', admin_deleted,
    'login_attempts', login_deleted,
    'security_events', security_deleted,
    'rate_limits', ratelimit_deleted,
    'email_log', email_deleted,
    'trash_items', trash_deleted,
    'cleaned_at', now()
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM anon, authenticated, public;

-- ── Job notturno ───────────────────────────────────────────────────────────
INSERT INTO public.internal_cron_tokens(name) VALUES ('purge-deleted-accounts') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0072 più l'eliminazione degli account scaduti
CREATE OR REPLACE FUNCTION public.cron_expected_jobs()
RETURNS TABLE(jobname text, max_age interval)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  VALUES
    ('send-lesson-reminders-30min'::text, interval '1 hour'),
    ('send-payment-reminders-daily', interval '26 hours'),
    ('blog-auto-publish-hourly', interval '2 hours'),
    ('data-retention-monthly-scan', interval '32 days'),
    ('cleanup-old-logs-nightly', interval '26 hours'),
    ('cron-health-check-hourly', interval '2 hours'),
    ('student-risk-check-daily', interval '26 hours'),
    ('subscription-pause-check-daily', interval '26 hours'),
    ('monthly-report-monthly', interval '32 days'),
    ('satisfaction-survey-daily', interval '26 hours'),
    ('school-closure-notice-daily', interval '26 hours'),
    ('google-calendar-sync-minute', interval '45 minutes'),
    ('purge-deleted-accounts-daily', interval '26 hours')
$$;

-- La chiamata parte solo se c'è un account nel cestino da più di 30 giorni
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-deleted-accounts-daily';
    PERFORM cron.schedule(
      'purge-deleted-accounts-daily',
      '30 2 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/purge-deleted-accounts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'purge-deleted-accounts')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      )
      WHERE EXISTS (SELECT 1 FROM public.account_trash WHERE deleted_at < now() - interval '30 days');
      $job$
    );
  END IF;
END
$cron$;

SELECT public.ensure_trash_triggers();

SELECT public.ensure_mfa_policies();

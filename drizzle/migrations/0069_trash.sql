-- Cestino delle eliminazioni fatte dagli admin (Admin → Cestino).
--
-- Le righe si cancellano come prima: niente soft delete, nessuna query
-- dell'app cambia. Un trigger BEFORE DELETE (a_trash_capture) ne salva una
-- copia in trash_items, insieme alle figlie cancellate a cascata. Ogni
-- richiesta dell'app è una transazione: tutto quello che sparisce con un click
-- finisce nello stesso batch e si ripristina insieme.
--
-- Si cattura solo quello che cancella un admin (con 2FA). Restano definitive
-- le eliminazioni con service role (data retention approvata in /admin/privacy,
-- account eliminati, cron) e quelle di insegnanti e alunni.
--
-- Il ripristino (restore_trash_batch) reinserisce le righe così com'erano a
-- trigger utente spenti: non si rifanno gli effetti di un inserimento nuovo
-- (monte ore scalato per le presenze, punti e badge per le consegne, calendario
-- e scadenze rigenerati per un gruppo, admin iscritti al corso, notifiche).
-- Poi rifà a mano i soli derivati da aggiornare: valore cliente e pagina
-- Notion dei lead, calendario Google degli insegnanti.
--
-- Dopo 30 giorni cleanup_old_logs() svuota il cestino. Chi crea una tabella
-- figlia (ON DELETE CASCADE) di una tabella già nel cestino deve chiamare
-- SELECT public.ensure_trash_triggers(); alla fine della migrazione.

-- ── Cestino ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trash_items (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL,
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  -- Righe che puntavano a questa e sono state staccate invece che cancellate
  -- (FK ON DELETE SET NULL, compiti stagionali): [{table, column, value, ids}]
  links jsonb,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trash_items_batch ON public.trash_items (batch_id, id);
CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON public.trash_items (deleted_at);

ALTER TABLE public.trash_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trash_items FROM anon, authenticated;
GRANT SELECT ON public.trash_items TO authenticated;
GRANT ALL ON public.trash_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trash_items_id_seq TO service_role;

-- Solo lettura per gli admin: scrivono il trigger e le funzioni qui sotto
DROP POLICY IF EXISTS "Admins can view trash" ON public.trash_items;
CREATE POLICY "Admins can view trash"
ON public.trash_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Un batch per riga: la prima riga cancellata (quella del click) e i conteggi
-- per tabella di tutto quello che è sparito con lei.
CREATE OR REPLACE VIEW public.trash_batches WITH (security_invoker = true) AS
SELECT f.batch_id,
       f.deleted_at,
       f.deleted_by,
       f.table_name AS root_table,
       f.row_data AS root_data,
       c.counts,
       c.total
FROM (
  SELECT DISTINCT ON (batch_id) batch_id, deleted_at, deleted_by, table_name, row_data
  FROM public.trash_items
  ORDER BY batch_id, id
) f
CROSS JOIN LATERAL (
  SELECT jsonb_object_agg(t.table_name, t.n) AS counts, sum(t.n)::int AS total
  FROM (
    SELECT i.table_name, count(*)::int AS n
    FROM public.trash_items i
    WHERE i.batch_id = f.batch_id
    GROUP BY i.table_name
  ) t
) c;

REVOKE ALL ON public.trash_batches FROM anon, authenticated;
GRANT SELECT ON public.trash_batches TO authenticated;
GRANT SELECT ON public.trash_batches TO service_role;

-- Nome leggibile di una riga, per i messaggi di errore del ripristino
CREATE OR REPLACE FUNCTION public.trash_row_label(_row jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT left(coalesce(
    nullif(btrim(_row->>'title'), ''),
    nullif(btrim(_row->>'name'), ''),
    nullif(btrim(_row->>'full_name'), ''),
    nullif(btrim(_row->>'term'), ''),
    nullif(btrim(_row->>'email'), ''),
    nullif(btrim(_row->>'slug'), ''),
    _row->>'id'
  ), 120);
$$;

-- ── Cattura ────────────────────────────────────────────────────────────────
-- Argomenti del trigger: 'tabella|colonna|colonna_riferita' per ogni tabella
-- che punta a questa e viene staccata invece che cancellata. Li calcola
-- ensure_trash_triggers(), così qui non si leggono i cataloghi a ogni riga.
CREATE OR REPLACE FUNCTION public.trash_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _state text := current_setting('techland.trash_batch', true);
  _batch text;
  _old jsonb := to_jsonb(OLD);
  _links jsonb := '[]'::jsonb;
  _spec text[];
  _ids jsonb;
  i int;
BEGIN
  -- Una decisione per transazione e per utente: o un batch nuovo o 'skip'
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

  FOR i IN 0 .. TG_NARGS - 1 LOOP
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

-- Mette il trigger sulle tabelle che l'admin cancella dall'app e su tutte le
-- loro figlie a cascata. Va richiamata quando una migrazione aggiunge una
-- tabella figlia (ON DELETE CASCADE) di una di queste.
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
  -- Account e ruoli non passano dal cestino
  _never constant text[] := ARRAY['profiles', 'user_roles', 'trash_items'];
  t record;
  _args text;
BEGIN
  FOR t IN
    WITH RECURSIVE scope(rel) AS (
      SELECT c.oid
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname = ANY (_roots)
      UNION
      SELECT con.conrelid
      FROM pg_constraint con JOIN scope s ON con.confrelid = s.rel
      WHERE con.contype = 'f' AND con.confdeltype = 'c'
    )
    SELECT c.oid, c.relname
    FROM scope s
    JOIN pg_class c ON c.oid = s.rel
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT (c.relname = ANY (_never))
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

-- ── Ripristino ─────────────────────────────────────────────────────────────
-- Errori (message / detail = tabella / hint = nome della riga), tradotti
-- dall'app:
--   trash_not_found       il batch non c'è più (già ripristinato o eliminato)
--   trash_conflict        esiste già una riga con gli stessi dati unici
--   trash_missing_parent  la riga dipende da qualcosa che non esiste più
--   trash_table_missing   la tabella non esiste più
--   trash_failed: …       altro errore del database
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

  DELETE FROM public.trash_items WHERE batch_id = _batch;
  RETURN _restored;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_trash_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_trash_batch(uuid) TO authenticated;

-- ── Eliminazione definitiva ────────────────────────────────────────────────
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
  DELETE FROM public.trash_items WHERE batch_id = _batch;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_trash_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_trash_batch(uuid) TO authenticated;

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
  DELETE FROM public.trash_items WHERE true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.empty_trash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empty_trash() TO authenticated;

-- ── Account eliminati ──────────────────────────────────────────────────────
-- Quando un account viene eliminato davvero, nel cestino non devono restare
-- righe con i suoi dati (e non si potrebbero comunque ripristinare).
CREATE OR REPLACE FUNCTION public.trash_forget_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.trash_items t
  WHERE EXISTS (SELECT 1 FROM jsonb_each_text(t.row_data) e WHERE e.value = OLD.id::text);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_forget_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trash_forget_profile ON public.profiles;
CREATE TRIGGER trash_forget_profile
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trash_forget_profile();

-- ── Conservazione: 30 giorni ───────────────────────────────────────────────
-- Come 0058_email_log.sql, più il cestino.
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

  DELETE FROM public.trash_items WHERE deleted_at < now() - interval '30 days';
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

SELECT public.ensure_trash_triggers();

SELECT public.ensure_mfa_policies();

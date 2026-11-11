-- Task di una lezione: eliminandone uno, quelli dopo scalano indietro di uno.
--
-- Elimino il task 3 di 5: il 4 diventa il 3 e il 5 diventa il 4. Lo fa il
-- trigger lesson_tasks_shift_after_delete per ogni eliminazione di un task di
-- una lezione che resta (non quando si elimina la lezione o il corso intero).
-- Progressi, bozze e segnalibri puntano all'id del task, non al numero.
--
-- Ripristinando il task dal Cestino torna al suo numero e quelli da lì in poi
-- avanzano di uno: la lezione torna com'era. restore_trash_batch è quello di
-- 0076_account_trash.sql con in più questo passaggio prima dei reinserimenti.
--
-- I numeri già esistenti non cambiano: nessuna rinumerazione dei buchi passati.

-- Sposta di _delta i task della lezione con numero >= _from (ripristino). Il vincolo
-- UNIQUE (lesson_id, task_number) si controlla riga per riga: prima i numeri
-- passano a negativi (tutti diversi), poi al valore finale.
CREATE OR REPLACE FUNCTION public.shift_lesson_tasks(_lesson uuid, _from int, _delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lesson_tasks
     SET task_number = -task_number - 1
   WHERE lesson_id = _lesson AND task_number >= _from;
  UPDATE public.lesson_tasks
     SET task_number = -task_number - 1 + _delta
   WHERE lesson_id = _lesson AND task_number < 0;
END;
$$;

REVOKE ALL ON FUNCTION public.shift_lesson_tasks(uuid, int, int) FROM PUBLIC, anon, authenticated;

-- Una volta per eliminazione (anche di più task insieme): ogni task rimasto
-- scala indietro di quanti task con numero più basso sono stati eliminati.
CREATE OR REPLACE FUNCTION public.lesson_tasks_shift_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lesson uuid;
BEGIN
  -- Lezioni eliminate insieme ai loro task: niente da rinumerare
  FOR _lesson IN
    SELECT DISTINCT o.lesson_id FROM deleted_tasks o
    WHERE EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = o.lesson_id)
  LOOP
    UPDATE public.lesson_tasks
       SET task_number = -task_number - 1
     WHERE lesson_id = _lesson
       AND task_number > (SELECT min(o.task_number) FROM deleted_tasks o WHERE o.lesson_id = _lesson);
    UPDATE public.lesson_tasks t
       SET task_number = (-t.task_number - 1) - (
             SELECT count(*) FROM deleted_tasks o
              WHERE o.lesson_id = _lesson AND o.task_number < -t.task_number - 1)
     WHERE t.lesson_id = _lesson AND t.task_number < 0;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.lesson_tasks_shift_after_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lesson_tasks_shift_after_delete ON public.lesson_tasks;
CREATE TRIGGER lesson_tasks_shift_after_delete
  AFTER DELETE ON public.lesson_tasks
  REFERENCING OLD TABLE AS deleted_tasks
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.lesson_tasks_shift_after_delete();

-- ── Ripristino dal Cestino ─────────────────────────────────────────────────
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

  -- Task di una lezione ancora esistente: torna al suo numero e quelli da lì in
  -- poi avanzano di uno (all'eliminazione erano scalati indietro, 0081).
  FOR _item IN
    SELECT t.* FROM public.trash_items t
    WHERE t.batch_id = _batch AND t.table_name = 'lesson_tasks'
      AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = (t.row_data->>'lesson_id')::uuid)
    ORDER BY (t.row_data->>'task_number')::int, t.id
  LOOP
    PERFORM public.shift_lesson_tasks((_item.row_data->>'lesson_id')::uuid,
                                      (_item.row_data->>'task_number')::int, 1);
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

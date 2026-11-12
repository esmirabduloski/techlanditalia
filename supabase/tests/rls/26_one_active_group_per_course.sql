-- Un solo gruppo ATTIVO per corso (drizzle/migrations/0084_one_active_group_per_course.sql).
--   - due gruppi attivi dello stesso corso: il secondo rifiuta lo studente;
--   - un gruppo archiviato non conta: dopo l'archiviazione lo studente entra nel nuovo;
--   - in un gruppo archiviato si può sempre aggiungere;
--   - riattivare un gruppo o cambiarne il corso viene rifiutato se crea un doppione;
--   - gruppi di corsi diversi restano liberi.
-- Mondo di 01_seed.sql: G1 (C1: S1, S3), G2 (C2: S2, S3, S4).

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s2 constant uuid := '00000000-0000-0000-0000-000000000102';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  c1 constant uuid := '00000000-0000-0000-0000-00000000c001';
  c2 constant uuid := '00000000-0000-0000-0000-00000000c002';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  g_new uuid := gen_random_uuid();
  g_old uuid := gen_random_uuid();
  g_other uuid := gen_random_uuid();
  failed boolean;
  msg text;
BEGIN
  INSERT INTO public.student_groups (id, title, course_id, teacher_id, status, start_date, lesson_days, lesson_time) VALUES
    (g_new, 'Nuovo C1', c1, t1, 'active', current_date, '{3}', '18:30'),
    (g_old, 'Vecchio C1', c1, t1, 'archived', current_date - 365, '{3}', '18:30'),
    (g_other, 'Altro C1', c1, t1, 'active', current_date, '{4}', '18:30');

  -- S1 è nel gruppo attivo G1 di C1: non entra in un altro gruppo attivo di C1
  failed := false;
  BEGIN
    INSERT INTO public.group_students (group_id, student_id) VALUES (g_new, s1);
  EXCEPTION WHEN raise_exception THEN failed := true; msg := SQLERRM;
  END;
  IF NOT failed OR msg NOT LIKE '%Gruppo G1%' THEN
    RAISE EXCEPTION 'one_active: S1 in due gruppi attivi dello stesso corso (%)', msg;
  END IF;

  -- In un gruppo archiviato sì (storico)
  INSERT INTO public.group_students (group_id, student_id) VALUES (g_old, s1);

  -- Gruppi di corsi diversi restano liberi: S2 (in G2, corso C2) entra in un gruppo di C1
  INSERT INTO public.group_students (group_id, student_id) VALUES (g_other, s2);

  -- G1 archiviato non conta più
  UPDATE public.student_groups SET status = 'archived', archived_at = now() WHERE id = g1;
  INSERT INTO public.group_students (group_id, student_id) VALUES (g_new, s1);

  -- Riattivare G1 farebbe due gruppi attivi di C1 per S1
  failed := false;
  BEGIN
    UPDATE public.student_groups SET status = 'active', archived_at = NULL WHERE id = g1;
  EXCEPTION WHEN raise_exception THEN failed := true; msg := SQLERRM;
  END;
  IF NOT failed OR msg NOT LIKE '%Nuovo C1%' THEN
    RAISE EXCEPTION 'one_active: riattivato un gruppo che crea un doppione (%)', msg;
  END IF;
  IF (SELECT status FROM public.student_groups WHERE id = g1) <> 'archived' THEN
    RAISE EXCEPTION 'one_active: G1 riattivato nonostante l''errore';
  END IF;

  -- Cambiare il corso di "Altro C1" in C2: S2 è già nel gruppo attivo G2 di C2
  failed := false;
  BEGIN
    UPDATE public.student_groups SET course_id = c2 WHERE id = g_other;
  EXCEPTION WHEN raise_exception THEN failed := true; msg := SQLERRM;
  END;
  IF NOT failed OR msg NOT LIKE '%Gruppo G2%' THEN
    RAISE EXCEPTION 'one_active: cambio di corso che crea un doppione (%)', msg;
  END IF;

  -- Altre modifiche a un gruppo attivo non sono toccate
  UPDATE public.student_groups SET title = 'Nuovo C1 (mercoledì)' WHERE id = g_new;

  -- Pulizia: G1 torna come nel seed
  DELETE FROM public.student_groups WHERE id IN (g_new, g_old, g_other);
  UPDATE public.student_groups SET status = 'active', archived_at = NULL WHERE id = g1;

  RAISE NOTICE 'Un gruppo attivo per corso: doppioni rifiutati, archiviati esclusi, corsi diversi liberi';
END $$;

-- Verifica di public.satisfaction_survey_due() (drizzle/migrations/0038_satisfaction_surveys.sql).
-- Gira come supabase_admin sul database usa-e-getta:
--   - "dopo 3 lezioni" scatta il giorno dopo la terza presenza, una volta sola;
--   - "fine modulo" scatta dopo l'ultima lezione di ogni modulo del corso, solo
--     se lo studente ne ha seguita almeno una e solo per lezioni recenti;
--   - un corso senza moduli conta come un modulo unico;
--   - le lezioni di oggi e i gruppi archiviati non contano.

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  g1 constant uuid := '00000000-0000-0000-0000-00000000a001';
  g2 constant uuid := '00000000-0000-0000-0000-00000000a002';
  c2 constant uuid := '00000000-0000-0000-0000-00000000c002';
  today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  n int;
  r record;
BEGIN
  -- C2: due moduli da due lezioni. C1: senza moduli, 2 lezioni nel gruppo G1.
  UPDATE public.courses SET detail_content = jsonb_build_object('modules', jsonb_build_array(
    jsonb_build_object('title', 'Primi passi', 'lessons', jsonb_build_array('1. a', '2. b')),
    jsonb_build_object('title', 'Il gioco', 'lessons', jsonb_build_array('3. c', '4. d'))
  )) WHERE id = c2;
  -- I test precedenti archiviano G1: qui servono entrambi i gruppi attivi
  UPDATE public.student_groups SET status = 'active', archived_at = NULL WHERE id IN (g1, g2);
  UPDATE public.student_groups SET max_lessons = 2 WHERE id = g1;

  DELETE FROM public.group_attendance WHERE group_id IN (g1, g2);
  DELETE FROM public.group_lesson_schedule WHERE group_id IN (g1, g2) AND lesson_number <= 5;
  INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES
    (g2, 1, today - 12), (g2, 2, today - 10), (g2, 3, today - 3), (g2, 4, today - 1), (g2, 5, today),
    (g1, 1, today - 5), (g1, 2, today - 2);

  -- S4 in G2: presente alle lezioni 1-3, assente alla 4 (ultima del modulo 2)
  INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES
    (g2, s4, 1, 'present'), (g2, s4, 2, 'present'), (g2, s4, 3, 'present'), (g2, s4, 4, 'absent'),
    (g2, s4, 5, 'present'),
    -- S1 in G1: presente solo alla prima
    (g1, s1, 1, 'present');

  CREATE TEMP TABLE due ON COMMIT DROP AS SELECT * FROM public.satisfaction_survey_due(7);

  SELECT count(*) INTO n FROM due WHERE student_id = s4 AND kind = 'after_3_lessons' AND lesson_date = today - 3;
  IF n <> 1 THEN RAISE EXCEPTION 'satisfaction: manca "dopo 3 lezioni" per S4 (righe %)', n; END IF;

  -- Modulo 1 finito 10 giorni fa: fuori finestra. Modulo 2 finito ieri: sì, anche se assente all'ultima.
  SELECT * INTO r FROM due WHERE student_id = s4 AND kind = 'module_end';
  IF r IS NULL OR r.module_number <> 2 OR r.module_title <> 'Il gioco' OR r.lesson_date <> today - 1 THEN
    RAISE EXCEPTION 'satisfaction: fine modulo di S4 sbagliata: %', to_jsonb(r);
  END IF;
  SELECT count(*) INTO n FROM due WHERE student_id = s4;
  IF n <> 2 THEN RAISE EXCEPTION 'satisfaction: per S4 attese 2 righe, trovate %', n; END IF;

  -- Corso senza moduli: fine corso alla lezione 2 di G1
  SELECT * INTO r FROM due WHERE student_id = s1;
  IF r IS NULL OR r.kind <> 'module_end' OR r.module_number <> 1 OR r.module_title <> 'Corso C1' THEN
    RAISE EXCEPTION 'satisfaction: fine corso senza moduli di S1 sbagliata: %', to_jsonb(r);
  END IF;

  -- Nessuna presenza nel modulo (S3 in G1, gli altri in G2): niente sondaggio
  SELECT count(*) INTO n FROM due WHERE student_id NOT IN (s1, s4);
  IF n <> 0 THEN RAISE EXCEPTION 'satisfaction: sondaggi per studenti senza presenze (%)', n; END IF;

  -- Una sola "dopo 3 lezioni" per studente, una per modulo
  DELETE FROM public.satisfaction_surveys WHERE student_id = s4;
  INSERT INTO public.satisfaction_surveys (student_id, recipient_id, kind) VALUES (s4, s4, 'after_3_lessons');
  BEGIN
    INSERT INTO public.satisfaction_surveys (student_id, recipient_id, group_id, kind) VALUES (s4, s4, g2, 'after_3_lessons');
    RAISE EXCEPTION 'satisfaction: accettato un secondo sondaggio "dopo 3 lezioni"';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.satisfaction_surveys (student_id, recipient_id, group_id, kind, module_number) VALUES (s4, s4, g2, 'module_end', 2);
  BEGIN
    INSERT INTO public.satisfaction_surveys (student_id, recipient_id, group_id, kind, module_number) VALUES (s4, s4, g2, 'module_end', 2);
    RAISE EXCEPTION 'satisfaction: accettato un doppio sondaggio di fine modulo';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Gruppo archiviato: niente
  UPDATE public.student_groups SET archived_at = now() WHERE id = g2;
  SELECT count(*) INTO n FROM public.satisfaction_survey_due(7) WHERE student_id = s4;
  IF n <> 0 THEN RAISE EXCEPTION 'satisfaction: sondaggi per un gruppo archiviato (%)', n; END IF;

  RAISE NOTICE 'satisfaction_survey: tutti i casi verificati';
END $$;

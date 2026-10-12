-- Verifica di public.student_risk_signals() (drizzle/migrations/0028_student_risk_tasks.sql)
-- sui dati di 01_seed.sql più qualche caso costruito qui. Gira come
-- supabase_admin dopo 02_checks.sql, sul database usa-e-getta; i trigger (streak, scadenze compiti) sono
-- sospesi per controllare esattamente i dati di partenza.
--
--   S1 (G1): presente, assente, assente          → consecutive_absences
--   S3 (G1): assente, giustificato               → nessuna assenza di fila
--   S2 (G2): compito scaduto 2 giorni fa, non consegnato → missing_homework
--   S4:      streak presenze azzerata oggi       → streak_broken
--   S3:      streak azzerata 2 mesi fa           → niente (fuori finestra)
--   S3:      saldo 1, ha comprato pacchetti      → low_balance
--   S4:      saldo 0, non usa pacchetti          → niente

SET LOCAL session_replication_role = replica;

-- Lezioni passate di G1
INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES
  ('00000000-0000-0000-0000-00000000a001', 101, current_date - 21),
  ('00000000-0000-0000-0000-00000000a001', 102, current_date - 14),
  ('00000000-0000-0000-0000-00000000a001', 103, current_date - 7)
ON CONFLICT (group_id, lesson_number) DO UPDATE SET lesson_date = EXCLUDED.lesson_date;

INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 101, 'present'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 102, 'absent'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 103, 'absent'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103', 102, 'absent'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103', 103, 'justified');

-- Compito di G2 scaduto da 2 giorni; S2 non l'ha consegnato
INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES
  ('00000000-0000-0000-0000-00000000a002', 1, current_date - 9)
ON CONFLICT (group_id, lesson_number) DO UPDATE SET lesson_date = EXCLUDED.lesson_date;
UPDATE public.group_students SET joined_at = now() - interval '30 days'
  WHERE group_id = '00000000-0000-0000-0000-00000000a002';
UPDATE public.homework_group_deadlines SET due_date = now() - interval '2 days'
  WHERE group_id = '00000000-0000-0000-0000-00000000a002';
DELETE FROM public.homework_submissions
  WHERE student_id = '00000000-0000-0000-0000-000000000102' AND homework_id = '00000000-0000-0000-0000-00000000d002';

-- Streak
UPDATE public.student_streaks SET attendance_streak = 0, best_attendance_streak = 5, updated_at = now()
  WHERE student_id = '00000000-0000-0000-0000-000000000104';
UPDATE public.student_streaks SET attendance_streak = 0, best_attendance_streak = 5, updated_at = now() - interval '60 days'
  WHERE student_id = '00000000-0000-0000-0000-000000000103';

-- Saldo lezioni
UPDATE public.profiles SET lesson_balance = 1 WHERE id = '00000000-0000-0000-0000-000000000103';
UPDATE public.profiles SET lesson_balance = 0 WHERE id = '00000000-0000-0000-0000-000000000104';
INSERT INTO public.lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after)
  VALUES ('00000000-0000-0000-0000-000000000103', 'credit_added', 10, 0, 10);

SET LOCAL session_replication_role = origin;

DO $$
DECLARE
  got jsonb;
  expected jsonb := jsonb_build_object(
    'Alunno S1', '["consecutive_absences"]'::jsonb,
    'Alunno S2', '["missing_homework"]'::jsonb,
    'Alunno S3', '["low_balance"]'::jsonb,
    'Alunno S4', '["streak_broken"]'::jsonb
  );
  s1_parent uuid;
BEGIN
  SELECT jsonb_object_agg(r.student_name, (SELECT jsonb_agg(x->>'kind' ORDER BY x->>'kind') FROM jsonb_array_elements(r.signals) x))
  INTO got FROM public.student_risk_signals('{}'::jsonb) r;
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'student_risk_signals: atteso %, ottenuto %', expected, got;
  END IF;

  SELECT parent_id INTO s1_parent FROM public.student_risk_signals('{}'::jsonb) WHERE student_name = 'Alunno S1';
  IF s1_parent IS DISTINCT FROM '00000000-0000-0000-0000-000000000201'::uuid THEN
    RAISE EXCEPTION 'student_risk_signals: parent_id di S1 errato (%)', s1_parent;
  END IF;

  -- Soglie personalizzate: saldo disattivato, 3 assenze di fila
  SELECT jsonb_object_agg(r.student_name, (SELECT jsonb_agg(x->>'kind' ORDER BY x->>'kind') FROM jsonb_array_elements(r.signals) x))
  INTO got FROM public.student_risk_signals('{"low_balance_threshold": null, "absences_in_a_row": 3}'::jsonb) r;
  expected := jsonb_build_object(
    'Alunno S2', '["missing_homework"]'::jsonb,
    'Alunno S4', '["streak_broken"]'::jsonb
  );
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'student_risk_signals con soglie personalizzate: atteso %, ottenuto %', expected, got;
  END IF;

  -- Gruppo archiviato: i suoi studenti non vengono più segnalati
  UPDATE public.student_groups SET archived_at = now() WHERE id = '00000000-0000-0000-0000-00000000a001';
  IF EXISTS (SELECT 1 FROM public.student_risk_signals('{}'::jsonb) WHERE student_name = 'Alunno S1') THEN
    RAISE EXCEPTION 'student_risk_signals: segnala S1 anche con il gruppo archiviato';
  END IF;

  RAISE NOTICE 'student_risk_signals: tutti i casi verificati';
END $$;

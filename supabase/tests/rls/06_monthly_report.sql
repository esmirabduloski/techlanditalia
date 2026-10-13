-- Verifica di public.monthly_report_stats() (drizzle/migrations/0037_monthly_report.sql).
-- Gira come supabase_admin dopo gli altri test. I dati costruiti qui stanno a
-- marzo 2020, lontano da quelli di 01_seed.sql (creati oggi); i trigger sono
-- sospesi per fissare a mano date e cambi di stato. I casi ai bordi del mese
-- controllano che le date si leggano in ora italiana (CET fino al 29/3, poi CEST).

SET LOCAL session_replication_role = replica;

-- Lead: R1 acquisito, R2 acquisito e poi perso, R3 acquisito ma nel cestino,
-- R4 acquisito il 29/2 alle 23:30 UTC (= 1° marzo in Italia),
-- R5 acquisito il 31/3 alle 22:30 UTC (= 1° aprile in Italia)
INSERT INTO public.crm_leads (id, email, full_name, pipeline_stage, deleted_at) VALUES
  ('00000000-0000-0000-0000-0000000e0001', 'trial1@report.test', 'R1', 'won', NULL),
  ('00000000-0000-0000-0000-0000000e0002', 'r2@report.test', 'R2', 'lost', NULL),
  ('00000000-0000-0000-0000-0000000e0003', 'r3@report.test', 'R3', 'won', now()),
  ('00000000-0000-0000-0000-0000000e0004', 'r4@report.test', 'R4', 'won', NULL),
  ('00000000-0000-0000-0000-0000000e0005', 'r5@report.test', 'R5', 'won', NULL);

INSERT INTO public.crm_interactions (lead_id, type, metadata, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e0001', 'status_change', '{"from":"new","to":"qualified"}', '2020-03-05 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0001', 'status_change', '{"from":"qualified","to":"won"}', '2020-03-20 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0002', 'status_change', '{"from":"new","to":"won"}', '2020-03-10 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0002', 'status_change', '{"from":"won","to":"lost"}', '2020-03-25 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0003', 'status_change', '{"from":"new","to":"won"}', '2020-03-15 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0004', 'status_change', '{"from":"new","to":"won"}', '2020-02-29 23:30+00'),
  ('00000000-0000-0000-0000-0000000e0005', 'status_change', '{"from":"new","to":"won"}', '2020-03-31 22:30+00'),
  ('00000000-0000-0000-0000-0000000e0001', 'note', '{"to":"won"}', '2020-03-21 10:00+00');

-- Nuovi studenti: S1 in G1 e S2 in G2 a marzo
UPDATE public.group_students SET joined_at = '2020-03-10 09:00+00'
  WHERE group_id = '00000000-0000-0000-0000-00000000a001' AND student_id = '00000000-0000-0000-0000-000000000101';
UPDATE public.group_students SET joined_at = '2020-03-12 09:00+00'
  WHERE group_id = '00000000-0000-0000-0000-00000000a002' AND student_id = '00000000-0000-0000-0000-000000000102';

-- Disdette: tre a marzo (una di tutta la famiglia), una il 1° aprile
INSERT INTO public.subscription_cancellations (lead_id, student_id, reason, would_return, cancelled_on) VALUES
  ('00000000-0000-0000-0000-0000000e0002', NULL, 'cost', 'yes', '2020-03-03'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-000000000102', 'cost', 'no', '2020-03-18'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-000000000103', 'schedule', 'maybe', '2020-03-31'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-000000000104', 'moving', 'no', '2020-04-01');

-- Pagamenti (paid_at è una data): 100 € e 50 € incassati a marzo, 70 € il 1°
-- aprile; una rata da 30 € scaduta a marzo e non pagata, una annullata
INSERT INTO public.crm_payments (lead_id, amount_cents, status, paid_at, due_date) VALUES
  ('00000000-0000-0000-0000-0000000e0001', 10000, 'paid', '2020-03-05', NULL),
  ('00000000-0000-0000-0000-0000000e0001', 5000, 'paid', '2020-03-31', NULL),
  ('00000000-0000-0000-0000-0000000e0001', 7000, 'paid', '2020-04-01', NULL),
  ('00000000-0000-0000-0000-0000000e0001', 3000, 'scheduled', NULL, '2020-03-20'),
  ('00000000-0000-0000-0000-0000000e0001', 4000, 'cancelled', NULL, '2020-03-20');

-- Prove: tre richieste a marzo (una della famiglia R1, email in maiuscolo),
-- una richiesta a febbraio e svolta a marzo
INSERT INTO public.trial_bookings (parent_name, email, child_age, interest, status, created_at, updated_at) VALUES
  ('R1', 'Trial1@Report.test', 10, 'python', 'completed', '2020-03-02 10:00+00', '2020-03-15 10:00+00'),
  ('T2', 't2@report.test', 9, 'scratch', 'cancelled', '2020-03-03 10:00+00', '2020-03-16 10:00+00'),
  ('T3', 't3@report.test', 11, 'python', 'pending', '2020-03-04 10:00+00', '2020-03-04 10:00+00'),
  ('T4', 't4@report.test', 12, 'python', 'completed', '2020-02-20 10:00+00', '2020-03-01 10:00+00');

-- Presenze di G1: due lezioni a marzo, una ad aprile
INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date) VALUES
  ('00000000-0000-0000-0000-00000000a001', 201, '2020-03-10'),
  ('00000000-0000-0000-0000-00000000a001', 202, '2020-03-17'),
  ('00000000-0000-0000-0000-00000000a001', 203, '2020-04-02')
ON CONFLICT (group_id, lesson_number) DO UPDATE SET lesson_date = EXCLUDED.lesson_date;
INSERT INTO public.group_attendance (group_id, student_id, lesson_number, status) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 201, 'present'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 202, 'absent'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103', 201, 'present'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103', 202, 'justified'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103', 203, 'present');

-- Uno studente segnalato a rischio a marzo (attività già chiusa)
INSERT INTO public.crm_tasks (lead_id, student_id, kind, title, status, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-000000000102', 'student_at_risk', 'Chiama', 'done', '2020-03-08 10:00+00'),
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-000000000102', 'other', 'Altro', 'done', '2020-03-08 10:00+00');

-- Sondaggi di gradimento (0034), se la tabella c'è. Inviati a marzo: A, B, D, E;
-- risposte a marzo: A 10, B 9, C 5 (inviato a febbraio). E risponde ad aprile.
DO $$
BEGIN
  IF to_regclass('public.satisfaction_surveys') IS NOT NULL THEN
    INSERT INTO public.satisfaction_surveys
      (student_id, recipient_id, group_id, kind, module_number, status, score, sent_at, answered_at) VALUES
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000a001', 'module_end', 901, 'answered', 10, '2020-03-02 10:00+00', '2020-03-03 10:00+00'),
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000a001', 'module_end', 902, 'answered', 9, '2020-03-05 10:00+00', '2020-03-06 10:00+00'),
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000a001', 'module_end', 903, 'answered', 5, '2020-02-27 10:00+00', '2020-03-01 10:00+00'),
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000a001', 'module_end', 904, 'pending', NULL, '2020-03-20 10:00+00', NULL),
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000a001', 'module_end', 905, 'answered', 3, '2020-03-30 10:00+00', '2020-04-02 10:00+00');
  END IF;
END $$;

DO $$
DECLARE
  r jsonb := public.monthly_report_stats('2020-03-01', '2020-04-01');
  expected jsonb := jsonb_build_object(
    'enrollments', '{"families_won": 2, "new_students": 2}'::jsonb,
    'cancellations', '{"total": 3, "whole_family": 1,
      "by_reason": [{"reason": "cost", "count": 2}, {"reason": "schedule", "count": 1}],
      "would_return": {"yes": 1, "maybe": 1, "no": 1}}'::jsonb,
    'revenue', '{"paid_cents": 15000, "paid_count": 2, "unpaid_cents": 3000, "unpaid_count": 1}'::jsonb,
    'trials', '{"requested": 3, "completed": 2, "cancelled": 1, "converted": 1}'::jsonb,
    'conversion', '{"won": 2, "lost": 1}'::jsonb,
    'satisfaction', '{"attendance_marked": 4, "attendance_present": 2, "attendance_justified": 1, "at_risk_flagged": 1}'::jsonb
      || jsonb_build_object('surveys', CASE WHEN to_regclass('public.satisfaction_surveys') IS NULL THEN NULL
         ELSE '{"sent": 4, "answered": 3, "promoters": 2, "detractors": 1, "avg_score": 8.0}'::jsonb END),
    -- Fotografia di oggi: dipende da cosa hanno fatto ai gruppi i test precedenti
    'active_students', (SELECT count(DISTINCT gs.student_id) FROM public.group_students gs
                        JOIN public.student_groups g ON g.id = gs.group_id
                        WHERE g.status = 'active' AND g.archived_at IS NULL)
  );
  k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    IF r->k IS DISTINCT FROM expected->k THEN
      RAISE EXCEPTION 'monthly_report_stats.%: atteso %, ottenuto %', k, expected->k, r->k;
    END IF;
  END LOOP;

  -- Un mese senza dati: tutto a zero, nessun errore
  r := public.monthly_report_stats('2019-01-01', '2019-02-01');
  IF (r->'revenue'->>'paid_cents')::int <> 0 OR r->'cancellations'->'by_reason' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'monthly_report_stats: mese vuoto non a zero: %', r;
  END IF;

  IF has_function_privilege('authenticated', 'public.monthly_report_stats(date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'monthly_report_stats: eseguibile dagli utenti, deve esserlo solo dal service role';
  END IF;

  RAISE NOTICE 'monthly_report_stats: tutti i casi verificati';
END $$;

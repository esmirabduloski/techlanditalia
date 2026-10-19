-- Dati di prova per i test dei permessi. Gira come supabase_admin (salta l'RLS).
--
-- Il mondo di prova:
--
--   Genitore P1 ── figli S1, S2          Genitore P2 ── figlio S3
--   Alunno S4 (nessun genitore collegato)
--
--   Gruppo G1 (corso C1, insegnante T1): S1, S3
--   Gruppo G2 (corso C2, insegnante T2): S2, S3, S4
--
--   S3 è in entrambi i gruppi: serve a verificare che T1 veda di S3 solo
--   quello che riguarda il proprio gruppo/corso e non quello di T2.
--
-- Ogni tabella con dati personali deve avere qui righe di almeno due persone
-- (o due gruppi), altrimenti 02_checks.sql fallisce e chiede di aggiungerle:
-- una tabella nuova senza dati di prova non sarebbe davvero verificata.

-- Utenti (il trigger on_auth_user_created crea il profilo "student")
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 's1@test.local', '{"full_name":"Alunno S1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 's2@test.local', '{"full_name":"Alunno S2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 's3@test.local', '{"full_name":"Alunno S3"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 's4@test.local', '{"full_name":"Alunno S4"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'p1@test.local', '{"full_name":"Genitore P1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'p2@test.local', '{"full_name":"Genitore P2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 't1@test.local', '{"full_name":"Insegnante T1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 't2@test.local', '{"full_name":"Insegnante T2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000901', 'authenticated', 'authenticated', 'admin@test.local', '{"full_name":"Admin"}', now(), now());

-- Il vecchio trigger prevent_role_self_escalation blocca il cambio di ruolo a
-- chiunque non sia admin (anche al service role): qui lo sospendiamo.
SET LOCAL session_replication_role = replica;
UPDATE public.profiles SET role = 'parent' WHERE id IN ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202');
UPDATE public.profiles SET parent_id = '00000000-0000-0000-0000-000000000201' WHERE id IN ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102');
UPDATE public.profiles SET parent_id = '00000000-0000-0000-0000-000000000202' WHERE id = '00000000-0000-0000-0000-000000000103';
UPDATE public.profiles SET referral_code = 'REFP1TEST' WHERE id = '00000000-0000-0000-0000-000000000201';
UPDATE public.profiles SET referral_code = 'REFP2TEST' WHERE id = '00000000-0000-0000-0000-000000000202';
SET LOCAL session_replication_role = origin;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000301', 'teacher'),
  ('00000000-0000-0000-0000-000000000302', 'teacher'),
  ('00000000-0000-0000-0000-000000000901', 'admin'),
  ('00000000-0000-0000-0000-000000000101', 'user'),
  ('00000000-0000-0000-0000-000000000103', 'user');

INSERT INTO auth.mfa_factors (user_id, status) VALUES
  ('00000000-0000-0000-0000-000000000301', 'verified'),
  ('00000000-0000-0000-0000-000000000302', 'verified'),
  ('00000000-0000-0000-0000-000000000901', 'verified');

INSERT INTO public.teacher_profiles (user_id) VALUES
  ('00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000302');

INSERT INTO public.teacher_background_checks (user_id, verified_at, next_check_at) VALUES
  ('00000000-0000-0000-0000-000000000301', current_date, current_date + 365),
  ('00000000-0000-0000-0000-000000000302', current_date, current_date + 365);

-- Corsi e contenuti
INSERT INTO public.courses (id, slug, title, is_visible) VALUES
  ('00000000-0000-0000-0000-00000000c001', 'test-c1', 'Corso C1', true),
  ('00000000-0000-0000-0000-00000000c002', 'test-c2', 'Corso C2', true);

INSERT INTO public.teacher_courses (teacher_id, course_id) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-00000000c002');

INSERT INTO public.lessons (id, course_id, lesson_number, title) VALUES
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 1, 'Lezione C1'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c002', 1, 'Lezione C2');

INSERT INTO public.lesson_tasks (id, lesson_id, task_number, title) VALUES
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 1, 'Esercizio C1'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e002', 1, 'Esercizio C2');

INSERT INTO public.homework (id, lesson_id, title) VALUES
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001', 'Compito C1'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000e002', 'Compito C2');

INSERT INTO public.scheduled_lessons (id, course_id, lesson_date, title) VALUES
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001', current_date, 'Lezione programmata C1'),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000c002', current_date, 'Lezione programmata C2');

INSERT INTO public.badges (id, name, description, requirement_type, requirement_value) VALUES
  ('00000000-0000-0000-0000-0000000ba001', 'Badge di prova', 'Test', 'lessons_completed', 1);

-- Gruppi
INSERT INTO public.student_groups (id, title, course_id, teacher_id, status, start_date, lesson_days, lesson_time,
                                   teacher_meeting_link, student_meeting_link, whatsapp_link) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'Gruppo G1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000301', 'active', current_date, '{1}', '17:00', 'https://t1.test', 'https://g1.test', 'https://wa.g1.test'),
  ('00000000-0000-0000-0000-00000000a002', 'Gruppo G2', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000302', 'active', current_date, '{2}', '18:00', 'https://t2.test', 'https://g2.test', 'https://wa.g2.test');

INSERT INTO public.group_students (group_id, student_id) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000104');

INSERT INTO public.enrollments (student_id, course_id, status) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000c001', 'active'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000c001', 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000c002', 'active'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000c002', 'active'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-00000000c002', 'active');

-- Dati di gruppo (group_lesson_schedule è già generato dal trigger sui gruppi)
INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date)
SELECT g, 99, current_date + 30
FROM unnest(ARRAY['00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002']::uuid[]) AS g
ON CONFLICT DO NOTHING;

INSERT INTO public.group_comments (group_id, author_id, content) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000301', 'Nota su G1'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000302', 'Nota su G2');

INSERT INTO public.homework_group_deadlines (homework_id, group_id, due_date) VALUES
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001', now() + interval '7 days'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000a002', now() + interval '7 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.lesson_reports (group_id, lesson_number, teacher_id) VALUES
  ('00000000-0000-0000-0000-00000000a001', 1, '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-00000000a002', 1, '00000000-0000-0000-0000-000000000302');

INSERT INTO public.teacher_notifications (teacher_id, title, message) VALUES
  ('00000000-0000-0000-0000-000000000301', 'Per T1', 'Test'),
  ('00000000-0000-0000-0000-000000000302', 'Per T2', 'Test');

-- Dati di ogni alunno, per ogni gruppo/corso in cui è iscritto
CREATE TEMP TABLE seed_membership AS
SELECT gs.student_id AS s, gs.group_id AS g, sg.course_id AS c,
       CASE sg.course_id WHEN '00000000-0000-0000-0000-00000000c001' THEN '00000000-0000-0000-0000-00000000e001'::uuid
                         ELSE '00000000-0000-0000-0000-00000000e002'::uuid END AS lesson,
       CASE sg.course_id WHEN '00000000-0000-0000-0000-00000000c001' THEN '00000000-0000-0000-0000-00000000f001'::uuid
                         ELSE '00000000-0000-0000-0000-00000000f002'::uuid END AS task,
       CASE sg.course_id WHEN '00000000-0000-0000-0000-00000000c001' THEN '00000000-0000-0000-0000-00000000d001'::uuid
                         ELSE '00000000-0000-0000-0000-00000000d002'::uuid END AS hw,
       CASE sg.course_id WHEN '00000000-0000-0000-0000-00000000c001' THEN '00000000-0000-0000-0000-00000000b001'::uuid
                         ELSE '00000000-0000-0000-0000-00000000b002'::uuid END AS sched,
       sg.teacher_id AS t
FROM public.group_students gs JOIN public.student_groups sg ON sg.id = gs.group_id;

INSERT INTO public.group_attendance (group_id, student_id, lesson_number) SELECT g, s, 1 FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.attendance (student_id, scheduled_lesson_id, status) SELECT s, sched, 'present' FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.homework_submissions (student_id, homework_id, status, notes) SELECT s, hw, 'pending', 'consegna' FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.lesson_progress (student_id, lesson_id) SELECT s, lesson FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.task_progress (student_id, task_id) SELECT s, task FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.student_code_drafts (student_id, task_id, code_type) SELECT s, task, 'python' FROM seed_membership ON CONFLICT DO NOTHING;
INSERT INTO public.bookmarks (user_id, entity_type, entity_id, course_id) SELECT s, 'lesson', lesson, c FROM seed_membership ON CONFLICT DO NOTHING;
-- Commenti dell'insegnante sull'alunno: uno per alunno+genitore, uno solo per i docenti
INSERT INTO public.student_comments (student_id, author_id, content, visibility)
SELECT s, t, 'Visibile ad alunno e genitore', ARRAY['student', 'parent'] FROM seed_membership
UNION ALL
SELECT s, t, 'Solo per i docenti', ARRAY['teacher'] FROM seed_membership ON CONFLICT DO NOTHING;

-- Dati per alunno (non legati a un gruppo)
CREATE TEMP TABLE seed_students AS
SELECT unnest(ARRAY['00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102',
                    '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000104']::uuid[]) AS s;

INSERT INTO public.student_streaks (student_id) SELECT s FROM seed_students ON CONFLICT DO NOTHING;
INSERT INTO public.streak_bonuses (student_id, streak_type, milestone, points_awarded) SELECT s, 'homework', 5, 10 FROM seed_students ON CONFLICT DO NOTHING;
INSERT INTO public.streak_freezes (student_id, freeze_type) SELECT s, 'homework' FROM seed_students ON CONFLICT DO NOTHING;
INSERT INTO public.lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after) SELECT s, 'test', 1, 0, 1 FROM seed_students ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements (user_id, badge_id) SELECT s, '00000000-0000-0000-0000-0000000ba001' FROM seed_students ON CONFLICT DO NOTHING;
-- Password degli alunni: S1 con la propria, S2 ancora con quella del genitore
INSERT INTO public.student_password_settings (student_id, own_password) VALUES
  ('00000000-0000-0000-0000-000000000101', true),
  ('00000000-0000-0000-0000-000000000102', false)
ON CONFLICT DO NOTHING;
-- Consensi media: la migrazione che li crea può non essere ancora nel repo.
DO $$
BEGIN
  IF to_regclass('public.media_consents') IS NOT NULL THEN
    INSERT INTO public.media_consents (student_id, purpose, granted) SELECT s, 'social', true FROM seed_students ON CONFLICT DO NOTHING;
    INSERT INTO public.media_consent_events (student_id, purpose, granted) SELECT s, 'social', true FROM seed_students ON CONFLICT DO NOTHING;
  END IF;
END $$;
-- Strumenti AI (0054): versione test-ai-1; S1 con 15 anni, S2 con 10, S3 senza
-- anno; consenso attivo per S1 (dato da lui) e S3 (dal genitore P2). Il
-- trigger ne scrive lo storico in ai_consent_events.
INSERT INTO public.ai_consent_versions (version, published_at) VALUES ('test-ai-1', current_date) ON CONFLICT DO NOTHING;
INSERT INTO public.student_birth_years (student_id, birth_year) VALUES
  ('00000000-0000-0000-0000-000000000101', extract(year FROM now())::int - 15),
  ('00000000-0000-0000-0000-000000000102', extract(year FROM now())::int - 10)
ON CONFLICT DO NOTHING;
INSERT INTO public.ai_consents (student_id, granted, version, decided_by, decided_as) VALUES
  ('00000000-0000-0000-0000-000000000101', true, 'test-ai-1', '00000000-0000-0000-0000-000000000101', 'student'),
  ('00000000-0000-0000-0000-000000000103', true, 'test-ai-1', '00000000-0000-0000-0000-000000000202', 'parent')
ON CONFLICT DO NOTHING;

-- Dati per utente (alunni, genitori, insegnanti)
CREATE TEMP TABLE seed_users AS
SELECT id AS u FROM auth.users WHERE email LIKE '%@test.local' AND email <> 'admin@test.local';

INSERT INTO public.push_devices (user_id, token) SELECT u, 'tok-' || u FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.push_notification_log (user_id, notification_type) SELECT u, 'test' FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.mfa_reset_requests (user_id) SELECT u FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.email_log (kind, to_email, recipient_id, subject, status, source)
SELECT 'pause_ending', 'seed-' || u || '@test.local', u, 'Seed', 'sent', 'seed' FROM seed_users;
INSERT INTO public.analytics_events (user_id, event_type, event_category, event_action, session_id) SELECT u, 't', 't', 't', 'sess-' || u FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.page_views (user_id, page_url, session_id) SELECT u, '/test', 'sess-' || u FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.conversion_funnels (user_id, funnel_name, step_number, step_name, session_id) SELECT u, 'f', 1, 's', 'sess-' || u FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.legal_document_versions (document, version, published_at, url) VALUES ('privacy', 'test-1', current_date, 'https://test.local/privacy')
ON CONFLICT DO NOTHING;
INSERT INTO public.consent_records (accepted_by, capacity, document, version)
SELECT u, 'self', 'privacy', 'test-1' FROM seed_users ON CONFLICT DO NOTHING;
INSERT INTO public.referrals (referrer_id, referrer_code)
SELECT id, referral_code FROM public.profiles WHERE referral_code IN ('REFP1TEST', 'REFP2TEST');
INSERT INTO public.crm_leads (id, email, full_name, linked_profile_id) VALUES
  ('00000000-0000-0000-0000-0000000ce001', 'p1@test.local', 'Genitore P1', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-0000000ce002', 'p2@test.local', 'Genitore P2', '00000000-0000-0000-0000-000000000202');
INSERT INTO public.crm_payments (lead_id, amount_cents) SELECT id, 1000 FROM public.crm_leads WHERE email LIKE '%@test.local';
INSERT INTO public.crm_interactions (lead_id, type)
SELECT id, (SELECT enum_range(NULL::public.crm_interaction_type))[1] FROM public.crm_leads WHERE email LIKE '%@test.local';
INSERT INTO public.crm_tasks (lead_id, student_id, kind, title) VALUES
  ('00000000-0000-0000-0000-0000000ce001', '00000000-0000-0000-0000-000000000101', 'student_at_risk', 'Chiama la famiglia di S1'),
  ('00000000-0000-0000-0000-0000000ce002', '00000000-0000-0000-0000-000000000103', 'student_at_risk', 'Chiama la famiglia di S3');
INSERT INTO public.subscription_cancellations (lead_id, student_id, reason, would_return) VALUES
  ('00000000-0000-0000-0000-0000000ce001', '00000000-0000-0000-0000-000000000102', 'schedule', 'maybe'),
  ('00000000-0000-0000-0000-0000000ce002', '00000000-0000-0000-0000-000000000103', 'cost', 'no');
-- Sondaggi di soddisfazione: P1 ha risposto per S1, P2 deve ancora rispondere per S3
INSERT INTO public.satisfaction_surveys (student_id, recipient_id, kind, status, score, sent_at, answered_at) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'after_3_lessons', 'answered', 10, now(), now()),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000202', 'after_3_lessons', 'pending', NULL, now(), NULL);

-- Proposte del corso successivo: S1 (G1) e S3 (G2) inviate, S2 (G2) ancora
-- bozza dell'insegnante, che il genitore P1 non deve vedere
INSERT INTO public.course_proposals (student_id, group_id, proposed_course_id, teacher_reason, status, offer_expires_on, sent_at) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002', 'Pronto per il corso C2, ottimi progressi', 'sent', current_date + 10, now()),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c001', 'Pronto per il corso C1, ottimi progressi', 'sent', current_date + 10, now()),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c001', 'Bozza: da rivedere in segreteria', 'draft', NULL, NULL);

-- Attestati di fine corso: S1 (G1) e S3 (G2) già sbloccati, S2 e S4 no
INSERT INTO public.course_certificates (student_id, group_id, student_name, course_title, teacher_name,
                                        lessons_attended, lessons_total, hours_attended, issued_on, code) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000a001', 'Alunno S1', 'Corso C1', 'Insegnante T1', 30, 32, 45, current_date, 'TL-TEST-S1G1'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000a002', 'Alunno S3', 'Corso C2', 'Insegnante T2', 28, 32, 42, current_date, 'TL-TEST-S3G2');

-- Mappa delle competenze: livelli confermati da T1 per S1 (G1) e da T2 per S2 (G2)
INSERT INTO public.student_skill_assessments (student_id, concept, level, note, assessed_by) VALUES
  ('00000000-0000-0000-0000-000000000101', 'cicli', 2, 'Usa bene i cicli', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000102', 'variabili', 1, NULL, '00000000-0000-0000-0000-000000000302');

-- Pause dell'abbonamento: S2 programmata, S3 già finita (nessuna in corso, per
-- non cambiare i risultati di 03 e 04)
INSERT INTO public.subscription_pauses (student_id, reason, starts_on, ends_on, ended_at, end_reason) VALUES
  ('00000000-0000-0000-0000-000000000102', 'summer', current_date + 30, current_date + 60, NULL, NULL),
  ('00000000-0000-0000-0000-000000000103', 'illness', current_date - 60, current_date - 30, now() - interval '30 days', 'auto');

-- Tabelle solo-admin con dati personali di terzi (moduli pubblici, log, chat)
INSERT INTO public.monthly_reports (month, stats, sent_to, sent_at) VALUES ('2020-01', '{}', '{admin@test.local}', now());
INSERT INTO public.admin_access_logs (admin_id, action) VALUES ('00000000-0000-0000-0000-000000000901', 'test');
INSERT INTO public.security_events (event_type) VALUES ('test');
INSERT INTO public.login_attempts (email) VALUES ('s1@test.local');
INSERT INTO public.contact_submissions (nome, email, oggetto, messaggio) VALUES ('Mario', 'mario@test.local', 'Info', 'Ciao');
INSERT INTO public.job_applications (nome, email, posizione, messaggio) VALUES ('Luca', 'luca@test.local', 'Docente', 'CV');
INSERT INTO public.trial_bookings (parent_name, email, child_age, interest) VALUES ('Anna', 'anna@test.local', 10, 'python');
INSERT INTO public.newsletter_subscribers (email) VALUES ('news@test.local');
INSERT INTO public.chat_conversations (id, session_id) VALUES ('00000000-0000-0000-0000-0000000cc001', 'chat-sess');
INSERT INTO public.chat_messages (conversation_id, role, content) VALUES ('00000000-0000-0000-0000-0000000cc001', 'user', 'Ciao');
INSERT INTO public.blocked_emails (pattern, type) VALUES ('blocked@test.local', 'email') ON CONFLICT DO NOTHING;
INSERT INTO public.rate_limits (identifier, endpoint) VALUES ('1.2.3.4', 'test');
INSERT INTO public.internal_cron_tokens (name) VALUES ('test-token') ON CONFLICT DO NOTHING;
INSERT INTO public.crm_tags (name) VALUES ('test-tag') ON CONFLICT DO NOTHING;
INSERT INTO public.crm_notion_sync_log (operation, status) VALUES ('test', 'ok');
INSERT INTO public.content_snapshots (entity_type, entity_id, entity_label, snapshot_data) VALUES ('course', gen_random_uuid(), 'x', '{}');
INSERT INTO public.push_templates (title, body) VALUES ('t', 'b');
INSERT INTO public.data_retention_runs DEFAULT VALUES;
INSERT INTO public.blog_settings DEFAULT VALUES ON CONFLICT DO NOTHING;
INSERT INTO public.crm_notion_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

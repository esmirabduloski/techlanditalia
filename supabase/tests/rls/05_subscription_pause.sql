-- Verifica della pausa dell'abbonamento (drizzle/migrations/0030_subscription_pauses.sql).
-- Gira come supabase_admin dopo 04_lesson_balance_alert.sql, sul database usa-e-getta:
--   - con una pausa in corso la lezione completata non scala il saldo;
--   - una pausa programmata o finita non blocca nulla;
--   - niente push "saldo basso" per gli studenti in pausa;
--   - una sola pausa aperta per studente.

SET client_min_messages = warning;
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net.calls (url text, body jsonb, has_token boolean);
TRUNCATE net.calls;
CREATE OR REPLACE FUNCTION net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO net.calls VALUES (url, body, true);
  SELECT 1::bigint;
$$;
SET client_min_messages = notice;

DO $$
DECLARE
  s4 constant uuid := '00000000-0000-0000-0000-000000000104';
  l1 constant uuid := '00000000-0000-0000-0000-00000000e001';
  pause_id uuid;
  bal int;
BEGIN
  DELETE FROM public.lesson_progress WHERE student_id = s4 AND lesson_id = l1;
  UPDATE public.profiles SET lesson_balance = 5 WHERE id = s4;

  -- Pausa programmata: non conta ancora, la lezione scala
  INSERT INTO public.subscription_pauses (student_id, starts_on) VALUES (s4, current_date + 3) RETURNING id INTO pause_id;
  IF public.is_student_paused(s4) THEN
    RAISE EXCEPTION 'subscription_pauses: una pausa programmata risulta già in corso';
  END IF;
  INSERT INTO public.lesson_progress (student_id, lesson_id) VALUES (s4, l1);
  SELECT lesson_balance INTO bal FROM public.profiles WHERE id = s4;
  IF bal <> 4 THEN RAISE EXCEPTION 'subscription_pauses: senza pausa in corso il saldo doveva scendere a 4, è %', bal; END IF;

  -- Pausa in corso: la lezione viene registrata ma il saldo resta
  UPDATE public.subscription_pauses SET starts_on = current_date - 1 WHERE id = pause_id;
  IF NOT public.is_student_paused(s4) THEN
    RAISE EXCEPTION 'subscription_pauses: la pausa in corso non viene riconosciuta';
  END IF;
  DELETE FROM public.lesson_progress WHERE student_id = s4 AND lesson_id = l1;
  INSERT INTO public.lesson_progress (student_id, lesson_id) VALUES (s4, l1);
  SELECT lesson_balance INTO bal FROM public.profiles WHERE id = s4;
  IF bal <> 4 THEN RAISE EXCEPTION 'subscription_pauses: durante la pausa il saldo è cambiato (%)', bal; END IF;

  -- In pausa niente push "saldo basso"
  UPDATE public.profiles SET lesson_balance = 2 WHERE id = s4;
  IF EXISTS (SELECT 1 FROM net.calls WHERE url LIKE '%/lesson-balance-alert') THEN
    RAISE EXCEPTION 'subscription_pauses: push saldo basso partita per uno studente in pausa';
  END IF;

  -- Una sola pausa aperta per studente
  BEGIN
    INSERT INTO public.subscription_pauses (student_id) VALUES (s4);
    RAISE EXCEPTION 'subscription_pauses: accettata una seconda pausa aperta';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Ripresa: si torna a scalare e a ricevere l'avviso
  UPDATE public.subscription_pauses SET ended_at = now(), end_reason = 'manual' WHERE id = pause_id;
  UPDATE public.profiles SET lesson_balance = 5 WHERE id = s4;
  DELETE FROM public.lesson_progress WHERE student_id = s4 AND lesson_id = l1;
  INSERT INTO public.lesson_progress (student_id, lesson_id) VALUES (s4, l1);
  SELECT lesson_balance INTO bal FROM public.profiles WHERE id = s4;
  IF bal <> 4 THEN RAISE EXCEPTION 'subscription_pauses: dopo la ripresa il saldo doveva scendere a 4, è %', bal; END IF;
  UPDATE public.profiles SET lesson_balance = 3 WHERE id = s4;
  IF NOT EXISTS (SELECT 1 FROM net.calls WHERE url LIKE '%/lesson-balance-alert' AND body->>'student_id' = s4::text) THEN
    RAISE EXCEPTION 'subscription_pauses: dopo la ripresa la push saldo basso non parte';
  END IF;

  RAISE NOTICE 'subscription_pauses: tutti i casi verificati';
END $$;

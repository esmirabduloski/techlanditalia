-- Verifica del trigger lesson_balance_low_alert (drizzle/migrations/0029_lesson_balance_alert.sql).
-- Nel database usa-e-getta pg_net viene tolto e net.http_post sostituita da una
-- funzione che registra le chiamate. La push deve partire solo quando il saldo
-- passa da più di 3 a 3 o meno.

DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net.calls (url text, body jsonb, has_token boolean);
CREATE OR REPLACE FUNCTION net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO net.calls VALUES (url, body, length(coalesce(headers->>'x-cron-token', '')) >= 32);
  SELECT 1::bigint;
$$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  calls jsonb;
  expected jsonb;
BEGIN
  UPDATE public.profiles SET lesson_balance = 5 WHERE id = s1;
  UPDATE public.profiles SET lesson_balance = 4 WHERE id = s1;   -- sopra soglia: niente
  UPDATE public.profiles SET lesson_balance = 3 WHERE id = s1;   -- arriva a 3: push
  UPDATE public.profiles SET lesson_balance = 2 WHERE id = s1;   -- già sotto: niente
  UPDATE public.profiles SET full_name = full_name WHERE id = s1; -- saldo invariato: niente
  UPDATE public.profiles SET lesson_balance = 10 WHERE id = s1;  -- ricarica: niente
  UPDATE public.profiles SET lesson_balance = 1 WHERE id = s1;   -- riscende saltando il 3: push

  SELECT coalesce(jsonb_agg(jsonb_build_object('balance', body->'balance', 'previous', body->'previous_balance',
                                               'student', body->>'student_id', 'token', has_token)), '[]')
  INTO calls FROM net.calls WHERE url LIKE '%/functions/v1/lesson-balance-alert';
  expected := jsonb_build_array(
    jsonb_build_object('balance', 3, 'previous', 4, 'student', s1, 'token', true),
    jsonb_build_object('balance', 1, 'previous', 10, 'student', s1, 'token', true)
  );
  IF calls IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'lesson_balance_low_alert: attese %, ottenute %', expected, calls;
  END IF;

  -- Se la chiamata fallisce il saldo si aggiorna lo stesso
  DROP FUNCTION net.http_post(text, jsonb, jsonb, integer);
  UPDATE public.profiles SET lesson_balance = 10 WHERE id = s1;
  UPDATE public.profiles SET lesson_balance = 3 WHERE id = s1;
  IF (SELECT lesson_balance FROM public.profiles WHERE id = s1) <> 3 THEN
    RAISE EXCEPTION 'lesson_balance_low_alert: un errore della notifica blocca il saldo';
  END IF;

  RAISE NOTICE 'lesson_balance_low_alert: tutti i casi verificati';
END $$;

INSERT INTO public.internal_cron_tokens(name) VALUES ('lesson-balance-alert') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_lesson_balance_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/lesson-balance-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
      'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'lesson-balance-alert')
    ),
    body := jsonb_build_object(
      'student_id', NEW.id,
      'balance', NEW.lesson_balance,
      'previous_balance', OLD.lesson_balance
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_lesson_balance_low: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_lesson_balance_low() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lesson_balance_low_alert ON public.profiles;
CREATE TRIGGER lesson_balance_low_alert
AFTER UPDATE OF lesson_balance ON public.profiles
FOR EACH ROW
WHEN (OLD.lesson_balance > 3 AND NEW.lesson_balance <= 3)
EXECUTE FUNCTION public.notify_lesson_balance_low();
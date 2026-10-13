-- Pausa dell'abbonamento invece della disdetta.
--
-- Per estate, esami o malattia l'admin mette in pausa uno studente invece di
-- fargli disdire l'abbonamento. Durante la pausa:
--   - il saldo lezioni non viene scalato in automatico;
--   - niente push alla famiglia (promemoria lezioni, rate) né avvisi agli admin
--     (saldo basso, studente a rischio): i filtri stanno nelle edge function e
--     nel trigger qui sotto;
--   - nel CRM il lead della famiglia mostra il badge IN PAUSA.
-- La pausa ha una data di ripresa facoltativa: quel giorno il job
-- subscription-pause-check la chiude da solo; 14 e 7 giorni prima avvisa la
-- famiglia via push ed email. L'admin può riprenderla a mano in qualsiasi momento.

CREATE TABLE IF NOT EXISTS public.subscription_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'other' CHECK (reason IN ('summer', 'exams', 'illness', 'other')),
  notes text,
  starts_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Rome')::date),
  -- Data di ripresa: null = finché l'admin non la riprende
  ends_on date CHECK (ends_on IS NULL OR ends_on > starts_on),
  ended_at timestamptz,
  ended_by uuid,
  end_reason text CHECK (end_reason IN ('manual', 'auto')),
  reminder_14_sent_at timestamptz,
  reminder_7_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Una sola pausa aperta per studente; quelle chiuse restano come storico
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscription_pauses_open
  ON public.subscription_pauses(student_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_pauses_student ON public.subscription_pauses(student_id);

DROP TRIGGER IF EXISTS update_subscription_pauses_updated_at ON public.subscription_pauses;
CREATE TRIGGER update_subscription_pauses_updated_at
  BEFORE UPDATE ON public.subscription_pauses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscription_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all subscription_pauses" ON public.subscription_pauses;
CREATE POLICY "Admins manage all subscription_pauses"
ON public.subscription_pauses FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Students view own subscription_pauses" ON public.subscription_pauses;
CREATE POLICY "Students view own subscription_pauses"
ON public.subscription_pauses FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Parents view children subscription_pauses" ON public.subscription_pauses;
CREATE POLICY "Parents view children subscription_pauses"
ON public.subscription_pauses FOR SELECT
TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Teachers view their students subscription_pauses" ON public.subscription_pauses;
CREATE POLICY "Teachers view their students subscription_pauses"
ON public.subscription_pauses FOR SELECT
TO authenticated
USING (public.is_teacher_of_student(auth.uid(), student_id));

SELECT public.ensure_mfa_policies();

-- Studente in pausa oggi (ora italiana). Una pausa con inizio futuro non conta ancora.
CREATE OR REPLACE FUNCTION public.is_student_paused(_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscription_pauses sp
    WHERE sp.student_id = _student
      AND sp.ended_at IS NULL
      AND sp.starts_on <= (now() AT TIME ZONE 'Europe/Rome')::date
  )
$$;

-- Serve a chi aggiorna il saldo (condizione del trigger saldo basso), non agli anonimi
REVOKE ALL ON FUNCTION public.is_student_paused(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_paused(uuid) TO authenticated, service_role;

-- Lezione completata: durante la pausa non si scala il saldo
CREATE OR REPLACE FUNCTION public.decrement_lesson_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  IF public.is_student_paused(NEW.student_id) THEN
    RETURN NEW;
  END IF;

  SELECT lesson_balance INTO current_balance FROM profiles WHERE id = NEW.student_id;

  -- Decrement balance (allow going to 0 but not negative)
  UPDATE profiles SET lesson_balance = GREATEST(current_balance - 1, 0) WHERE id = NEW.student_id;

  -- Log the operation
  INSERT INTO lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
  VALUES (
    NEW.student_id,
    'lesson_completed',
    -1,
    current_balance,
    GREATEST(current_balance - 1, 0),
    NEW.student_id,
    'Lezione completata automaticamente'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_lesson_balance() FROM anon, authenticated, public;

-- Niente push "saldo basso" agli admin per gli studenti in pausa (0029)
DROP TRIGGER IF EXISTS lesson_balance_low_alert ON public.profiles;
CREATE TRIGGER lesson_balance_low_alert
AFTER UPDATE OF lesson_balance ON public.profiles
FOR EACH ROW
WHEN (OLD.lesson_balance > 3 AND NEW.lesson_balance <= 3 AND NOT public.is_student_paused(NEW.id))
EXECUTE FUNCTION public.notify_lesson_balance_low();

INSERT INTO public.internal_cron_tokens(name) VALUES ('subscription-pause-check') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0028 più il controllo giornaliero delle pause
CREATE OR REPLACE FUNCTION public.cron_expected_jobs()
RETURNS TABLE(jobname text, max_age interval)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  VALUES
    ('send-lesson-reminders-30min'::text, interval '1 hour'),
    ('send-payment-reminders-daily', interval '26 hours'),
    ('blog-auto-publish-hourly', interval '2 hours'),
    ('data-retention-monthly-scan', interval '32 days'),
    ('cleanup-old-logs-nightly', interval '26 hours'),
    ('cron-health-check-hourly', interval '2 hours'),
    ('student-risk-check-daily', interval '26 hours'),
    ('subscription-pause-check-daily', interval '26 hours')
$$;

-- Ogni mattina alle 07:00 UTC (9:00 in Italia d'estate): riprese automatiche e avvisi
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'subscription-pause-check-daily';
    PERFORM cron.schedule(
      'subscription-pause-check-daily',
      '0 7 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/subscription-pause-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'subscription-pause-check')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  END IF;
END
$cron$;

-- Calendario di chiusure e festività.
--
-- L'admin le gestisce in /admin/chiusure (a mano o caricando le festività
-- nazionali); i genitori le vedono in anticipo nell'area riservata. Quando si
-- genera il calendario di un gruppo i giorni di chiusura vengono saltati.
-- Tre giorni prima il job school-closure-notice avvisa con push ed email le
-- famiglie che in quei giorni avrebbero lezione (notified_at evita i doppioni).
--
-- Valgono per tutta la scuola (non per gruppo). Le leggono tutti gli utenti
-- autenticati, le scrive solo l'admin (con 2FA, tramite mfa_required).

CREATE TABLE IF NOT EXISTS public.school_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  -- Quando il job ha avvisato le famiglie; torna NULL se l'admin sposta le date
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_closures_dates_check CHECK (end_date >= start_date),
  -- Le festività nazionali si caricano con un upsert: niente doppioni
  CONSTRAINT school_closures_start_title_key UNIQUE (start_date, title)
);

ALTER TABLE public.school_closures ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_school_closures_end_date ON public.school_closures(end_date);

-- Date cambiate dopo l'avviso: le famiglie vanno avvisate di nuovo (se la chiusura non è già iniziata)
CREATE OR REPLACE FUNCTION public.school_closures_reset_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.start_date, OLD.end_date)
     AND NEW.notified_at IS NOT DISTINCT FROM OLD.notified_at
     AND NEW.start_date > (now() AT TIME ZONE 'Europe/Rome')::date THEN
    NEW.notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_closures_reset_notice ON public.school_closures;
CREATE TRIGGER school_closures_reset_notice
  BEFORE UPDATE ON public.school_closures
  FOR EACH ROW EXECUTE FUNCTION public.school_closures_reset_notice();

DROP TRIGGER IF EXISTS update_school_closures_updated_at ON public.school_closures;
CREATE TRIGGER update_school_closures_updated_at
  BEFORE UPDATE ON public.school_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.school_closures ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_closures TO authenticated;
GRANT ALL ON public.school_closures TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view school closures" ON public.school_closures;
CREATE POLICY "Authenticated users can view school closures"
ON public.school_closures FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert school closures" ON public.school_closures;
CREATE POLICY "Admins can insert school closures"
ON public.school_closures FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update school closures" ON public.school_closures;
CREATE POLICY "Admins can update school closures"
ON public.school_closures FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete school closures" ON public.school_closures;
CREATE POLICY "Admins can delete school closures"
ON public.school_closures FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Il calendario generato alla creazione di un gruppo (trigger
-- auto_generate_schedule_on_group_create) salta i giorni di chiusura, come
-- buildLessonDates lato client. Il resto è identico alla versione di febbraio.
CREATE OR REPLACE FUNCTION public.auto_generate_lesson_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_date_iter date;
  lesson_count integer := 0;
  max_lessons_val integer;
  day_of_week integer;
BEGIN
  -- Only generate if start_date and lesson_days are set
  IF NEW.start_date IS NULL OR NEW.lesson_days IS NULL OR array_length(NEW.lesson_days, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  max_lessons_val := COALESCE(NEW.max_lessons, 32);
  current_date_iter := NEW.start_date;

  -- Iterate through dates to find lesson days, skipping school closures
  WHILE lesson_count < max_lessons_val LOOP
    day_of_week := EXTRACT(DOW FROM current_date_iter)::integer;

    IF day_of_week = ANY(NEW.lesson_days)
       AND NOT EXISTS (SELECT 1 FROM public.school_closures c
                       WHERE current_date_iter BETWEEN c.start_date AND c.end_date) THEN
      lesson_count := lesson_count + 1;
      INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date, lesson_title, lesson_time)
      VALUES (
        NEW.id,
        lesson_count,
        current_date_iter,
        'M' || CEIL(lesson_count::numeric / 4) || 'L' || ((lesson_count - 1) % 4 + 1),
        NEW.lesson_time
      );
    END IF;

    current_date_iter := current_date_iter + 1;

    -- Safety: don't iterate more than 2 years
    IF current_date_iter > NEW.start_date + interval '730 days' THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Famiglie da avvisare per una chiusura: chi ha un figlio in un gruppo attivo
-- che in quei giorni avrebbe lezione. Un gruppo conta se è già iniziato entro
-- la fine della chiusura, se uno dei suoi giorni di lezione cade nel periodo
-- (o non ha giorni impostati) e se il suo calendario non è già finito prima.
-- recipient_id è il genitore, o lo studente stesso se non ha un genitore.
-- La pausa dell'abbonamento la filtra la edge function.
CREATE OR REPLACE FUNCTION public.school_closure_audience(p_closure_id uuid)
RETURNS TABLE(recipient_id uuid, student_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (
    SELECT start_date, end_date FROM public.school_closures WHERE id = p_closure_id
  ),
  closed_dows AS (
    SELECT DISTINCT extract(dow FROM d)::int AS dow
    FROM c, generate_series(c.start_date, LEAST(c.end_date, c.start_date + 6), interval '1 day') AS d
  ),
  groups AS (
    SELECT g.id
    FROM public.student_groups g, c
    WHERE g.status = 'active'
      AND (g.start_date IS NULL OR g.start_date <= c.end_date)
      AND (coalesce(cardinality(g.lesson_days), 0) = 0
           OR EXISTS (SELECT 1 FROM closed_dows WHERE closed_dows.dow = ANY (g.lesson_days)))
      AND (NOT EXISTS (SELECT 1 FROM public.group_lesson_schedule s WHERE s.group_id = g.id)
           OR EXISTS (SELECT 1 FROM public.group_lesson_schedule s
                      WHERE s.group_id = g.id AND s.lesson_date >= c.start_date))
  )
  SELECT coalesce(p.parent_id, p.id) AS recipient_id, array_agg(DISTINCT p.id ORDER BY p.id) AS student_ids
  FROM public.group_students gs
  JOIN groups ON groups.id = gs.group_id
  JOIN public.profiles p ON p.id = gs.student_id
  GROUP BY coalesce(p.parent_id, p.id);
$$;

REVOKE ALL ON FUNCTION public.school_closure_audience(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_closure_audience(uuid) TO service_role;

INSERT INTO public.internal_cron_tokens(name) VALUES ('school-closure-notice') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0038 più l'avviso giornaliero delle chiusure
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
    ('subscription-pause-check-daily', interval '26 hours'),
    ('monthly-report-monthly', interval '32 days'),
    ('satisfaction-survey-daily', interval '26 hours'),
    ('school-closure-notice-daily', interval '26 hours')
$$;

-- Ogni giorno alle 07:00 UTC (9:00 in Italia d'estate, 8:00 d'inverno), come la fine pausa
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'school-closure-notice-daily';
    PERFORM cron.schedule(
      'school-closure-notice-daily',
      '0 7 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/school-closure-notice',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'school-closure-notice')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  END IF;
END
$cron$;

SELECT public.ensure_mfa_policies();

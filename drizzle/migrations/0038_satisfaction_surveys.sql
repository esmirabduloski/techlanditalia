-- Sondaggio di soddisfazione automatico.
--
-- Ogni pomeriggio il job satisfaction-survey legge
-- public.satisfaction_survey_due() e manda alla famiglia (il genitore, o
-- l'alunno senza genitore) un sondaggio di due domande:
--   1. quanto consigliereste TECHLAND a un amico? (0-10)
--   2. commento libero.
-- Due momenti:
--   - after_3_lessons: il giorno dopo la terza lezione con presenza dello
--     studente (una volta sola, le prime tre lezioni in assoluto);
--   - module_end: il giorno dopo l'ultima lezione di ogni modulo del corso
--     (courses.detail_content.modules, le lezioni sono numerate di seguito:
--     4 + 4 + ... ). Un corso senza moduli conta come un modulo unico.
-- Si risponde dall'area riservata; la edge function salva la risposta e:
--   - chi è soddisfatto riceve l'invito a recensire su Trustpilot e il proprio
--     link referral (sulla pagina e via email);
--   - un voto basso apre nel CRM un'attività "Chiama la famiglia".
-- Le soglie stanno in site_settings.satisfaction_survey_rules.

CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Chi risponde: il genitore, o l'alunno se non ha un genitore
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.student_groups(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('after_3_lessons', 'module_end')),
  -- Solo module_end: numero (da 1) e titolo del modulo appena finito
  module_number int,
  module_title text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped', 'expired')),
  -- skipped: perché non è stato inviato (es. sondaggio recente, studente in pausa)
  skip_reason text,
  score smallint CHECK (score BETWEEN 0 AND 10),
  comment text,
  -- Esito con le soglie del momento della risposta
  satisfied boolean,
  sent_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'answered' OR score IS NOT NULL)
);

-- Un sondaggio "prime tre lezioni" per studente, uno per modulo di ogni gruppo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_satisfaction_after_3
  ON public.satisfaction_surveys(student_id) WHERE kind = 'after_3_lessons';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_satisfaction_module_end
  ON public.satisfaction_surveys(student_id, group_id, module_number) WHERE kind = 'module_end';
CREATE INDEX IF NOT EXISTS idx_satisfaction_recipient_pending
  ON public.satisfaction_surveys(recipient_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_satisfaction_created ON public.satisfaction_surveys(created_at DESC);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all satisfaction_surveys" ON public.satisfaction_surveys;
CREATE POLICY "Admins manage all satisfaction_surveys"
ON public.satisfaction_surveys FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- La famiglia vede i propri sondaggi; risponde tramite la edge function
DROP POLICY IF EXISTS "Recipients view own satisfaction_surveys" ON public.satisfaction_surveys;
CREATE POLICY "Recipients view own satisfaction_surveys"
ON public.satisfaction_surveys FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

SELECT public.ensure_mfa_policies();

-- Soglie (stessi valori di DEFAULT_RULES in supabase/functions/_shared/satisfactionsurvey.ts)
INSERT INTO public.site_settings(key, value) VALUES ('satisfaction_survey_rules', jsonb_build_object(
  'enabled', true,
  -- Da questo voto in su: link referral
  'satisfied_min', 9,
  -- Da questo voto in su: invito Trustpilot
  'trustpilot_min', 9,
  -- Fino a questo voto: attività "Chiama la famiglia" nel CRM
  'low_max', 6,
  -- Nessun nuovo sondaggio per lo stesso studente prima di N giorni
  'cooldown_days', 14,
  -- Un sondaggio senza risposta sparisce dopo N giorni
  'expire_days', 21
)) ON CONFLICT (key) DO NOTHING;

-- Sondaggi da creare oggi. Solo lezioni degli ultimi _window_days giorni (e
-- già passate: il sondaggio parte dal giorno dopo), così all'attivazione non
-- partono sondaggi per moduli finiti mesi fa. Non esclude quelli già creati:
-- ci pensano gli indici unici.
CREATE OR REPLACE FUNCTION public.satisfaction_survey_due(_window_days int DEFAULT 7)
RETURNS TABLE(student_id uuid, group_id uuid, kind text, module_number int, module_title text, lesson_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH today AS (
    SELECT (now() AT TIME ZONE 'Europe/Rome')::date AS d
  ),
  members AS (
    -- Studenti nei gruppi attivi
    SELECT gs.student_id, gs.group_id, g.max_lessons, c.title AS course_title, c.total_lessons,
           CASE WHEN jsonb_typeof(c.detail_content->'modules') = 'array'
                THEN c.detail_content->'modules' ELSE '[]'::jsonb END AS modules
    FROM group_students gs
    JOIN student_groups g ON g.id = gs.group_id
    JOIN courses c ON c.id = g.course_id
    WHERE g.status = 'active' AND g.archived_at IS NULL
  ),
  attended AS (
    -- Lezioni già svolte con presenza, numerate per studente su tutti i gruppi
    SELECT a.student_id, a.group_id, a.lesson_number, s.lesson_date,
           row_number() OVER (PARTITION BY a.student_id ORDER BY s.lesson_date, a.lesson_number) AS n
    FROM group_attendance a
    JOIN group_lesson_schedule s ON s.group_id = a.group_id AND s.lesson_number = a.lesson_number
    WHERE a.status = 'present' AND s.lesson_date < (SELECT d FROM today)
  ),
  after_3 AS (
    SELECT at.student_id, at.group_id, 'after_3_lessons'::text AS kind,
           NULL::int AS module_number, NULL::text AS module_title, at.lesson_date
    FROM attended at
    JOIN members m ON m.student_id = at.student_id AND m.group_id = at.group_id
    WHERE at.n = 3 AND at.lesson_date >= (SELECT d FROM today) - _window_days
  ),
  module_ranges AS (
    -- Prima e ultima lezione di ogni modulo: le lezioni dei moduli si sommano
    SELECT x.student_id, x.group_id, x.module_number, x.module_title,
           x.last_lesson - x.len + 1 AS first_lesson, x.last_lesson
    FROM (
      SELECT m.student_id, m.group_id, md.ord::int AS module_number,
             coalesce(nullif(trim(md.value->>'title'), ''), 'Modulo ' || md.ord) AS module_title,
             jsonb_array_length(CASE WHEN jsonb_typeof(md.value->'lessons') = 'array'
                                     THEN md.value->'lessons' ELSE '[]'::jsonb END) AS len,
             sum(jsonb_array_length(CASE WHEN jsonb_typeof(md.value->'lessons') = 'array'
                                         THEN md.value->'lessons' ELSE '[]'::jsonb END))
               OVER (PARTITION BY m.student_id, m.group_id ORDER BY md.ord)::int AS last_lesson
      FROM members m
      CROSS JOIN LATERAL jsonb_array_elements(m.modules) WITH ORDINALITY AS md(value, ord)
    ) x
    WHERE x.len > 0
    UNION ALL
    -- Corso senza moduli: un modulo unico fino all'ultima lezione
    SELECT m.student_id, m.group_id, 1, m.course_title, 1,
           coalesce(m.max_lessons, nullif(m.total_lessons, 0))
    FROM members m
    WHERE jsonb_array_length(m.modules) = 0
      AND coalesce(m.max_lessons, nullif(m.total_lessons, 0)) > 0
  ),
  module_end AS (
    SELECT r.student_id, r.group_id, 'module_end'::text, r.module_number, r.module_title, s.lesson_date
    FROM module_ranges r
    JOIN group_lesson_schedule s ON s.group_id = r.group_id AND s.lesson_number = r.last_lesson
    WHERE s.lesson_date < (SELECT d FROM today)
      AND s.lesson_date >= (SELECT d FROM today) - _window_days
      -- Lo studente ha seguito almeno una lezione del modulo
      AND EXISTS (
        SELECT 1 FROM attended at
        WHERE at.student_id = r.student_id AND at.group_id = r.group_id
          AND at.lesson_number BETWEEN r.first_lesson AND r.last_lesson
      )
  )
  SELECT * FROM after_3
  UNION ALL
  SELECT * FROM module_end;
$$;

REVOKE ALL ON FUNCTION public.satisfaction_survey_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.satisfaction_survey_due(int) TO service_role;

INSERT INTO public.internal_cron_tokens(name) VALUES ('satisfaction-survey') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0037 più l'invio giornaliero dei sondaggi
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
    ('satisfaction-survey-daily', interval '26 hours')
$$;

-- Ogni giorno alle 16:00 UTC (18:00 in Italia d'estate): le famiglie rispondono
-- più volentieri la sera che la mattina
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'satisfaction-survey-daily';
    PERFORM cron.schedule(
      'satisfaction-survey-daily',
      '0 16 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/satisfaction-survey',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'satisfaction-survey')
        ),
        body := '{"action":"scan"}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  END IF;
END
$cron$;

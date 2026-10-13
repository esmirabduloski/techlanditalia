-- Report mensile automatico per gli admin.
--
-- Il primo del mese il job monthly-report-monthly chiama la edge function
-- monthly-report, che legge public.monthly_report_stats() per il mese appena
-- chiuso e per quello prima (per il confronto) e manda una mail a tutti gli
-- admin con:
--   - iscrizioni: famiglie passate ad "Acquisito" nel CRM, nuovi studenti nei gruppi;
--   - disdette: dal questionario di disdetta (0031), per motivo e "tornerebbero?";
--   - incassi: rate pagate (crm_payments.paid_at, una data), rate scadute nel mese ancora da incassare;
--   - prove: richieste di lezione di prova, svolte e annullate;
--   - conversione: acquisiti su chiusi (won + lost) nel mese, come in CRM → Analytics;
--   - soddisfazione: voti del sondaggio di gradimento (satisfaction_surveys, 0038:
--     NPS, voto medio, tasso di risposta) più presenza media alle lezioni e
--     studenti segnalati a rischio. Se la tabella dei sondaggi non c'è, surveys è null.
-- Le date si leggono in ora italiana. Ogni report inviato resta in
-- monthly_reports: il job non manda due volte lo stesso mese.

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  -- Mese del report, 'YYYY-MM'
  month text PRIMARY KEY CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  stats jsonb NOT NULL,
  sent_to text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_monthly_reports_updated_at ON public.monthly_reports;
CREATE TRIGGER update_monthly_reports_updated_at
  BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view monthly_reports" ON public.monthly_reports;
CREATE POLICY "Admins view monthly_reports"
ON public.monthly_reports FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

SELECT public.ensure_mfa_policies();

-- Numeri del periodo [_from, _to) (date in ora italiana).
CREATE OR REPLACE FUNCTION public.monthly_report_stats(_from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t_from timestamptz := _from::timestamp AT TIME ZONE 'Europe/Rome';
  t_to timestamptz := _to::timestamp AT TIME ZONE 'Europe/Rome';
  result jsonb;
  surveys jsonb;
BEGIN
  -- Sondaggio di gradimento (0034): letto solo se la tabella esiste
  IF to_regclass('public.satisfaction_surveys') IS NOT NULL THEN
    EXECUTE $q$
      SELECT jsonb_build_object(
        'sent', count(*) FILTER (WHERE sent_at >= $1 AND sent_at < $2),
        'answered', count(*) FILTER (WHERE status = 'answered' AND answered_at >= $1 AND answered_at < $2),
        -- NPS: promotori 9-10, detrattori 0-6
        'promoters', count(*) FILTER (WHERE status = 'answered' AND answered_at >= $1 AND answered_at < $2 AND score >= 9),
        'detractors', count(*) FILTER (WHERE status = 'answered' AND answered_at >= $1 AND answered_at < $2 AND score <= 6),
        'avg_score', round(avg(score) FILTER (WHERE status = 'answered' AND answered_at >= $1 AND answered_at < $2), 1)
      )
      FROM public.satisfaction_surveys
      WHERE (sent_at >= $1 AND sent_at < $2) OR (answered_at >= $1 AND answered_at < $2)
    $q$ INTO surveys USING t_from, t_to;
  END IF;

  WITH stage_changes AS (
    -- Ultimo passaggio a won/lost di ogni lead nel periodo
    SELECT DISTINCT ON (i.lead_id) i.lead_id, i.metadata->>'to' AS stage
    FROM crm_interactions i
    JOIN crm_leads l ON l.id = i.lead_id AND l.deleted_at IS NULL
    WHERE i.type = 'status_change'
      AND i.metadata->>'to' IN ('won', 'lost')
      AND i.created_at >= t_from AND i.created_at < t_to
    ORDER BY i.lead_id, i.created_at DESC
  ),
  cancellations AS (
    SELECT * FROM subscription_cancellations
    WHERE cancelled_on >= _from AND cancelled_on < _to
  ),
  trials AS (
    SELECT * FROM trial_bookings WHERE created_at >= t_from AND created_at < t_to
  ),
  lessons AS (
    SELECT a.status
    FROM group_attendance a
    JOIN group_lesson_schedule s ON s.group_id = a.group_id AND s.lesson_number = a.lesson_number
    WHERE s.lesson_date >= _from AND s.lesson_date < _to
  )
  SELECT jsonb_build_object(
    'from', _from,
    'to', _to,
    'enrollments', jsonb_build_object(
      'families_won', (SELECT count(*) FROM stage_changes WHERE stage = 'won'),
      'new_students', (SELECT count(*) FROM group_students
                       WHERE joined_at >= t_from AND joined_at < t_to)
    ),
    'cancellations', jsonb_build_object(
      'total', (SELECT count(*) FROM cancellations),
      'whole_family', (SELECT count(*) FROM cancellations WHERE student_id IS NULL),
      'by_reason', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'count', n)
                                              ORDER BY n DESC, reason), '[]'::jsonb)
                    FROM (SELECT reason, count(*) AS n FROM cancellations GROUP BY reason) r),
      'would_return', jsonb_build_object(
        'yes', (SELECT count(*) FROM cancellations WHERE would_return = 'yes'),
        'maybe', (SELECT count(*) FROM cancellations WHERE would_return = 'maybe'),
        'no', (SELECT count(*) FROM cancellations WHERE would_return = 'no')
      )
    ),
    'revenue', jsonb_build_object(
      'paid_cents', (SELECT coalesce(sum(amount_cents), 0) FROM crm_payments
                     WHERE status = 'paid' AND paid_at >= _from AND paid_at < _to),
      'paid_count', (SELECT count(*) FROM crm_payments
                     WHERE status = 'paid' AND paid_at >= _from AND paid_at < _to),
      -- Rate con scadenza nel periodo non ancora pagate (oggi)
      'unpaid_cents', (SELECT coalesce(sum(amount_cents), 0) FROM crm_payments
                       WHERE status = 'scheduled' AND due_date >= _from AND due_date < _to),
      'unpaid_count', (SELECT count(*) FROM crm_payments
                       WHERE status = 'scheduled' AND due_date >= _from AND due_date < _to)
    ),
    'trials', jsonb_build_object(
      'requested', (SELECT count(*) FROM trials),
      -- Svolte/annullate: l'ultimo cambio di stato cade nel periodo
      'completed', (SELECT count(*) FROM trial_bookings
                    WHERE status = 'completed' AND updated_at >= t_from AND updated_at < t_to),
      'cancelled', (SELECT count(*) FROM trial_bookings
                    WHERE status = 'cancelled' AND updated_at >= t_from AND updated_at < t_to),
      -- Delle richieste del periodo, quante famiglie sono già iscritte
      'converted', (SELECT count(DISTINCT lower(t.email)) FROM trials t
                    JOIN crm_leads l ON l.email = lower(t.email)
                    WHERE l.pipeline_stage = 'won' AND l.deleted_at IS NULL)
    ),
    'conversion', jsonb_build_object(
      'won', (SELECT count(*) FROM stage_changes WHERE stage = 'won'),
      'lost', (SELECT count(*) FROM stage_changes WHERE stage = 'lost')
    ),
    'satisfaction', jsonb_build_object(
      'surveys', surveys,
      'attendance_marked', (SELECT count(*) FROM lessons),
      'attendance_present', (SELECT count(*) FROM lessons WHERE status = 'present'),
      'attendance_justified', (SELECT count(*) FROM lessons WHERE status = 'justified'),
      'at_risk_flagged', (SELECT count(*) FROM crm_tasks
                          WHERE kind = 'student_at_risk' AND created_at >= t_from AND created_at < t_to)
    ),
    -- Fotografia di oggi, senza confronto con il mese prima
    'active_students', (SELECT count(DISTINCT gs.student_id)
                        FROM group_students gs
                        JOIN student_groups g ON g.id = gs.group_id
                        WHERE g.status = 'active' AND g.archived_at IS NULL)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.monthly_report_stats(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_report_stats(date, date) TO service_role;

INSERT INTO public.internal_cron_tokens(name) VALUES ('monthly-report') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0030 più il report mensile
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
    ('monthly-report-monthly', interval '32 days')
$$;

-- Il primo del mese alle 06:00 UTC (7:00 o 8:00 in Italia)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monthly-report-monthly';
    PERFORM cron.schedule(
      'monthly-report-monthly',
      '0 6 1 * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/monthly-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'monthly-report')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  END IF;
END
$cron$;

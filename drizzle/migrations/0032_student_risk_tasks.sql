CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  details text,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  due_at timestamptz NOT NULL DEFAULT now(),
  assigned_to uuid,
  completed_at timestamptz,
  completed_by uuid,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_tasks_open
  ON public.crm_tasks(student_id, kind) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status_due ON public.crm_tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks(lead_id);

DROP TRIGGER IF EXISTS update_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all crm_tasks" ON public.crm_tasks;
CREATE POLICY "Admins manage all crm_tasks"
ON public.crm_tasks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

SELECT public.ensure_mfa_policies();

INSERT INTO public.site_settings(key, value) VALUES ('student_risk_rules', jsonb_build_object(
  'enabled', true,
  'absences_in_a_row', 2,
  'homework_missing_min', 1,
  'homework_window_days', 14,
  'streak_window_days', 14,
  'low_balance_threshold', 2,
  'cooldown_days', 14
)) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.student_risk_signals(_rules jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(student_id uuid, student_name text, parent_id uuid, signals jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  absences_n int := greatest(coalesce((_rules->>'absences_in_a_row')::int, 2), 1);
  hw_min int := greatest(coalesce((_rules->>'homework_missing_min')::int, 1), 1);
  hw_window interval := make_interval(days => greatest(coalesce((_rules->>'homework_window_days')::int, 14), 1));
  streak_window interval := make_interval(days => greatest(coalesce((_rules->>'streak_window_days')::int, 14), 1));
  balance_max int := (_rules->>'low_balance_threshold')::int;
BEGIN
  IF NOT (_rules ? 'low_balance_threshold') THEN balance_max := 2; END IF;

  RETURN QUERY
  WITH members AS (
    SELECT gs.student_id, gs.group_id, gs.joined_at, g.title AS group_title, g.course_id
    FROM group_students gs
    JOIN student_groups g ON g.id = gs.group_id
    WHERE g.status = 'active' AND g.archived_at IS NULL
  ),
  absences AS (
    SELECT r.student_id, jsonb_build_object(
      'kind', 'consecutive_absences',
      'group_id', r.group_id,
      'group_title', max(r.group_title),
      'count', count(*),
      'dates', jsonb_agg(r.lesson_date ORDER BY r.lesson_date)
    ) AS signal
    FROM (
      SELECT m.student_id, m.group_id, m.group_title, s.lesson_date, a.status,
             row_number() OVER (PARTITION BY a.student_id, a.group_id ORDER BY a.lesson_number DESC) AS rn
      FROM members m
      JOIN group_attendance a ON a.student_id = m.student_id AND a.group_id = m.group_id
      JOIN group_lesson_schedule s ON s.group_id = a.group_id AND s.lesson_number = a.lesson_number
      WHERE s.lesson_date <= current_date
    ) r
    WHERE r.rn <= absences_n
    GROUP BY r.student_id, r.group_id
    HAVING count(*) = absences_n AND bool_and(r.status = 'absent')
  ),
  homework_missing AS (
    SELECT x.student_id, jsonb_build_object(
      'kind', 'missing_homework',
      'count', count(*),
      'items', jsonb_agg(jsonb_build_object('title', x.title, 'due', x.due) ORDER BY x.due)
    ) AS signal
    FROM (
      SELECT DISTINCT ON (m.student_id, h.id) m.student_id, h.title,
             coalesce(hgd.due_date, h.due_date) AS due
      FROM members m
      JOIN lessons l ON l.course_id = m.course_id
      JOIN homework h ON h.lesson_id = l.id AND NOT h.preview_only
      JOIN group_lesson_schedule s ON s.group_id = m.group_id AND s.lesson_number = l.lesson_number
      LEFT JOIN homework_group_deadlines hgd ON hgd.homework_id = h.id AND hgd.group_id = m.group_id
      WHERE coalesce(hgd.due_date, h.due_date) < now()
        AND coalesce(hgd.due_date, h.due_date) >= now() - hw_window
        AND s.lesson_date >= coalesce(m.joined_at::date, '-infinity'::date)
        AND NOT EXISTS (
          SELECT 1 FROM homework_submissions hs
          WHERE hs.student_id = m.student_id AND hs.homework_id = h.id
        )
    ) x
    GROUP BY x.student_id
    HAVING count(*) >= hw_min
  ),
  streaks AS (
    SELECT st.student_id, jsonb_build_object(
      'kind', 'streak_broken',
      'attendance', st.attendance_streak = 0 AND coalesce(st.best_attendance_streak, 0) > 0,
      'homework', st.homework_streak = 0 AND coalesce(st.best_homework_streak, 0) > 0,
      'best_attendance', st.best_attendance_streak,
      'best_homework', st.best_homework_streak
    ) AS signal
    FROM student_streaks st
    WHERE st.student_id IN (SELECT m.student_id FROM members m)
      AND st.updated_at >= now() - streak_window
      AND (
        (st.attendance_streak = 0 AND coalesce(st.best_attendance_streak, 0) > 0)
        OR (st.homework_streak = 0 AND coalesce(st.best_homework_streak, 0) > 0)
      )
  ),
  balance AS (
    SELECT p.id AS student_id, jsonb_build_object(
      'kind', 'low_balance',
      'balance', p.lesson_balance,
      'threshold', balance_max
    ) AS signal
    FROM profiles p
    WHERE balance_max IS NOT NULL
      AND p.id IN (SELECT m.student_id FROM members m)
      AND p.lesson_balance <= balance_max
      AND EXISTS (
        SELECT 1 FROM lesson_balance_log lb
        WHERE lb.student_id = p.id AND lb.operation_type = 'credit_added'
      )
  ),
  all_signals AS (
    SELECT * FROM absences
    UNION ALL SELECT * FROM homework_missing
    UNION ALL SELECT * FROM streaks
    UNION ALL SELECT * FROM balance
  )
  SELECT p.id, p.full_name, p.parent_id, jsonb_agg(s.signal ORDER BY s.signal->>'kind')
  FROM all_signals s
  JOIN profiles p ON p.id = s.student_id
  GROUP BY p.id, p.full_name, p.parent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_risk_signals(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_risk_signals(jsonb) TO service_role;

INSERT INTO public.internal_cron_tokens(name) VALUES ('student-risk-check') ON CONFLICT DO NOTHING;

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
    ('student-risk-check-daily', interval '26 hours')
$$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'student-risk-check-daily';
    PERFORM cron.schedule(
      'student-risk-check-daily',
      '30 6 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/student-risk-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'student-risk-check')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  END IF;
END
$cron$;
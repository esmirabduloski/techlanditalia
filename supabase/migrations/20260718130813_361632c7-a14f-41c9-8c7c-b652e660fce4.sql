
-- 1) user_achievements: remove client INSERT (trigger check_and_award_badges handles awards)
DROP POLICY IF EXISTS "System can insert achievements" ON public.user_achievements;

-- 2) lesson_progress / task_progress: remove permissive client INSERT policies
DROP POLICY IF EXISTS "Students can insert their progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Students can insert their task progress" ON public.task_progress;

-- SECURITY DEFINER RPCs to validate completion server-side
CREATE OR REPLACE FUNCTION public.complete_lesson(_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _course uuid;
  _lesson_num int;
  _group uuid;
  _scheduled_date date;
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.is_enrolled_for_lesson(_student, _lesson_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  -- Already completed? idempotent
  IF EXISTS (SELECT 1 FROM public.lesson_progress WHERE student_id = _student AND lesson_id = _lesson_id) THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT l.course_id, l.lesson_number INTO _course, _lesson_num
  FROM public.lessons l WHERE l.id = _lesson_id;

  -- Find the student's group for this course
  SELECT sg.id INTO _group
  FROM public.student_groups sg
  JOIN public.group_students gs ON gs.group_id = sg.id
  WHERE gs.student_id = _student AND sg.course_id = _course
  LIMIT 1;

  IF _group IS NOT NULL THEN
    SELECT gls.lesson_date INTO _scheduled_date
    FROM public.group_lesson_schedule gls
    WHERE gls.group_id = _group AND gls.lesson_number = _lesson_num;

    -- Require that the scheduled lesson date has arrived
    IF _scheduled_date IS NULL OR _scheduled_date > CURRENT_DATE THEN
      RETURN jsonb_build_object('success', false, 'error', 'lesson_not_yet_available');
    END IF;
  END IF;

  INSERT INTO public.lesson_progress (student_id, lesson_id)
  VALUES (_student, _lesson_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _lesson uuid;
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.is_enrolled_for_task(_student, _task_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  IF EXISTS (SELECT 1 FROM public.task_progress WHERE student_id = _student AND task_id = _task_id) THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT lesson_id INTO _lesson FROM public.lesson_tasks WHERE id = _task_id;

  -- Task can be completed only if the parent lesson is available (scheduled date reached)
  -- Reuse complete_lesson's date check via schedule lookup
  IF _lesson IS NOT NULL THEN
    DECLARE
      _course uuid;
      _lesson_num int;
      _group uuid;
      _scheduled_date date;
    BEGIN
      SELECT l.course_id, l.lesson_number INTO _course, _lesson_num
      FROM public.lessons l WHERE l.id = _lesson;

      SELECT sg.id INTO _group
      FROM public.student_groups sg
      JOIN public.group_students gs ON gs.group_id = sg.id
      WHERE gs.student_id = _student AND sg.course_id = _course
      LIMIT 1;

      IF _group IS NOT NULL THEN
        SELECT gls.lesson_date INTO _scheduled_date
        FROM public.group_lesson_schedule gls
        WHERE gls.group_id = _group AND gls.lesson_number = _lesson_num;

        IF _scheduled_date IS NULL OR _scheduled_date > CURRENT_DATE THEN
          RETURN jsonb_build_object('success', false, 'error', 'task_not_yet_available');
        END IF;
      END IF;
    END;
  END IF;

  INSERT INTO public.task_progress (student_id, task_id)
  VALUES (_student, _task_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;

-- 3) page_views UPDATE: replace spoofable session-header policy with auth-owner check
DROP POLICY IF EXISTS "Owners can update recent page views" ON public.page_views;

CREATE POLICY "Authenticated owners can update their recent page views"
ON public.page_views
FOR UPDATE
TO authenticated
USING (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND entered_at > (now() - interval '2 hours')
)
WITH CHECK (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND entered_at > (now() - interval '2 hours')
);

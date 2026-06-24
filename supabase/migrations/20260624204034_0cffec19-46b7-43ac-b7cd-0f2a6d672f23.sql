
-- Enrollment check helpers
CREATE OR REPLACE FUNCTION public.is_enrolled_for_lesson(_student_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.enrollments e ON e.course_id = l.course_id
    WHERE l.id = _lesson_id
      AND e.student_id = _student_id
      AND e.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_for_task(_student_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lesson_tasks t
    JOIN public.lessons l ON l.id = t.lesson_id
    JOIN public.enrollments e ON e.course_id = l.course_id
    WHERE t.id = _task_id
      AND e.student_id = _student_id
      AND e.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_for_homework(_student_id uuid, _homework_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.homework h
    JOIN public.lessons l ON l.id = h.lesson_id
    JOIN public.enrollments e ON e.course_id = l.course_id
    WHERE h.id = _homework_id
      AND e.student_id = _student_id
      AND e.status = 'active'
  )
$$;

-- Tighten INSERT policies to require active enrollment
DROP POLICY IF EXISTS "Students can insert their progress" ON public.lesson_progress;
CREATE POLICY "Students can insert their progress"
ON public.lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.is_enrolled_for_lesson(auth.uid(), lesson_id)
);

DROP POLICY IF EXISTS "Students can insert their task progress" ON public.task_progress;
CREATE POLICY "Students can insert their task progress"
ON public.task_progress
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.is_enrolled_for_task(auth.uid(), task_id)
);

DROP POLICY IF EXISTS "Students can insert their submissions" ON public.homework_submissions;
CREATE POLICY "Students can insert their submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.is_enrolled_for_homework(auth.uid(), homework_id)
);

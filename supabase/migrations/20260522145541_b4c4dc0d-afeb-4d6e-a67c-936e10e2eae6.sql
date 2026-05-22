
-- Helper: check if user is enrolled in a course
CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _user_id AND course_id = _course_id AND status = 'active'
  )
$$;

-- Helper: check if user (parent) has a child enrolled in a course
CREATE OR REPLACE FUNCTION public.is_parent_of_enrolled(_parent_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.student_id
    WHERE p.parent_id = _parent_id AND e.course_id = _course_id AND e.status = 'active'
  )
$$;

-- Helper: check if user is a teacher of a group for a course
CREATE OR REPLACE FUNCTION public.is_teacher_of_course(_teacher_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_groups
    WHERE teacher_id = _teacher_id AND course_id = _course_id
  )
$$;

-- LESSONS: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view lessons" ON public.lessons;
CREATE POLICY "Authorized users can view lessons" ON public.lessons
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_enrolled_in_course(auth.uid(), course_id)
  OR is_parent_of_enrolled(auth.uid(), course_id)
  OR is_teacher_of_course(auth.uid(), course_id)
);

-- LESSON_TASKS: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.lesson_tasks;
CREATE POLICY "Authorized users can view tasks" ON public.lesson_tasks
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_tasks.lesson_id
      AND (
        is_enrolled_in_course(auth.uid(), l.course_id)
        OR is_parent_of_enrolled(auth.uid(), l.course_id)
        OR is_teacher_of_course(auth.uid(), l.course_id)
      )
  )
);

-- HOMEWORK: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view homework" ON public.homework;
CREATE POLICY "Authorized users can view homework" ON public.homework
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = homework.lesson_id
      AND (
        is_enrolled_in_course(auth.uid(), l.course_id)
        OR is_parent_of_enrolled(auth.uid(), l.course_id)
        OR is_teacher_of_course(auth.uid(), l.course_id)
      )
  )
);

-- STUDENT_STREAKS: allow teachers to read their students' streaks
CREATE POLICY "Teachers can view streaks of their students" ON public.student_streaks
FOR SELECT
USING (is_teacher_of_student(auth.uid(), student_id));

-- REALTIME: restrict channel subscriptions to authenticated users only (baseline)
-- Postgres-changes already enforce table RLS; this restricts broadcast/presence channels.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use own user-scoped channels" ON realtime.messages;
CREATE POLICY "Authenticated can use own user-scoped channels"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- Allow postgres_changes (no topic) and topics scoped to the user's id, or admin
  (realtime.topic() IS NULL)
  OR (realtime.topic() LIKE '%' || auth.uid()::text || '%')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

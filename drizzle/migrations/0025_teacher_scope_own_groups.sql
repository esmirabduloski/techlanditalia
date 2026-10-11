CREATE OR REPLACE FUNCTION public.is_teacher_of_student_in_course(_teacher_id uuid, _student_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = _student_id
      AND sg.teacher_id = _teacher_id
      AND sg.course_id = _course_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_teacher_of_student_in_course(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student_in_course(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Teachers can view groups of their students" ON public.student_groups;
DROP POLICY IF EXISTS "Teachers can view all memberships of their students" ON public.group_students;

DROP POLICY IF EXISTS "Teachers can view student enrollments" ON public.enrollments;
CREATE POLICY "Teachers can view student enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (public.is_teacher_of_student_in_course(auth.uid(), student_id, course_id));

DROP POLICY IF EXISTS "Teachers can view attendance of their students" ON public.attendance;
CREATE POLICY "Teachers can view attendance of their students"
ON public.attendance FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.scheduled_lessons sl
  WHERE sl.id = attendance.scheduled_lesson_id
    AND public.is_teacher_of_student_in_course(auth.uid(), attendance.student_id, sl.course_id)
));

DROP POLICY IF EXISTS "Teachers can view progress for their students" ON public.lesson_progress;
CREATE POLICY "Teachers can view progress for their students"
ON public.lesson_progress FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.lessons l
  WHERE l.id = lesson_progress.lesson_id
    AND public.is_teacher_of_student_in_course(auth.uid(), lesson_progress.student_id, l.course_id)
));

DROP POLICY IF EXISTS "Teachers can view submissions for their students" ON public.homework_submissions;
CREATE POLICY "Teachers can view submissions for their students"
ON public.homework_submissions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework h
  JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, l.course_id)
));

DROP POLICY IF EXISTS "Teachers can grade submissions for their students" ON public.homework_submissions;
CREATE POLICY "Teachers can grade submissions for their students"
ON public.homework_submissions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework h
  JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, l.course_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.homework h
  JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, l.course_id)
));
CREATE POLICY "Teachers can view attendance of their students"
ON public.attendance
FOR SELECT
TO authenticated
USING (public.is_teacher_of_student(auth.uid(), student_id));

-- Allow teachers to view enrollments of students they teach
CREATE POLICY "Teachers can view student enrollments"
ON public.enrollments
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), student_id));

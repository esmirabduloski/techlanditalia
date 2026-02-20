
-- Allow teachers to view homework submissions for their students
CREATE POLICY "Teachers can view submissions for their students"
ON public.homework_submissions
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), student_id));

-- Allow teachers to update (grade) homework submissions for their students
CREATE POLICY "Teachers can grade submissions for their students"
ON public.homework_submissions
FOR UPDATE
USING (public.is_teacher_of_student(auth.uid(), student_id));

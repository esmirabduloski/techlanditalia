-- Add teacher SELECT policy for lesson_progress
CREATE POLICY "Teachers can view progress for their students"
ON public.lesson_progress
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), student_id));

-- Remove any lingering wildcard-based realtime policy if present
DROP POLICY IF EXISTS "Authenticated can use own user-scoped channels" ON realtime.messages;
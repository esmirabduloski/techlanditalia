-- Tighten UPDATE policies on group_comments and student_comments so that teachers
-- must still be assigned to the relevant group/student to modify their own comments.

DROP POLICY IF EXISTS "Teachers can update their own group comments" ON public.group_comments;
CREATE POLICY "Teachers can update their own group comments"
ON public.group_comments
FOR UPDATE
USING (auth.uid() = author_id AND public.is_teacher_of_group(auth.uid(), group_id))
WITH CHECK (auth.uid() = author_id AND public.is_teacher_of_group(auth.uid(), group_id));

DROP POLICY IF EXISTS "Teachers can update their own comments" ON public.student_comments;
CREATE POLICY "Teachers can update their own comments"
ON public.student_comments
FOR UPDATE
USING (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = student_comments.student_id
      AND sg.teacher_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = student_comments.student_id
      AND sg.teacher_id = auth.uid()
  )
);
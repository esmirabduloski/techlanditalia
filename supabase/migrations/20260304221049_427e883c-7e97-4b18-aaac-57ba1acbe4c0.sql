CREATE POLICY "Students can view teacher profiles of their groups"
ON public.teacher_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = auth.uid() AND sg.teacher_id = teacher_profiles.user_id
  )
);

CREATE POLICY "Parents can view teacher profiles of children groups"
ON public.teacher_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    JOIN public.profiles p ON p.id = gs.student_id
    WHERE p.parent_id = auth.uid() AND sg.teacher_id = teacher_profiles.user_id
  )
);
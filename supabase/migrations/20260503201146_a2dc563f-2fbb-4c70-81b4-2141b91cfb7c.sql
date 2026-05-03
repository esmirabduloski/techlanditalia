
-- 1) blog_settings: remove public read, admins-only (admins ALL policy already exists)
DROP POLICY IF EXISTS "Anyone can view blog settings" ON public.blog_settings;

-- 2) homework_group_deadlines: remove public read, scope to authenticated users related to the group
DROP POLICY IF EXISTS "Anyone can view homework deadlines" ON public.homework_group_deadlines;

CREATE POLICY "Related users can view homework deadlines"
ON public.homework_group_deadlines
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_student_in_group(auth.uid(), group_id)
  OR is_parent_of_group(auth.uid(), group_id)
  OR is_teacher_of_group(auth.uid(), group_id)
);

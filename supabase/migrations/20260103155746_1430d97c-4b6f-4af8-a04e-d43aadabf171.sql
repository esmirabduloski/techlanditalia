-- Drop and recreate admin policy for student_groups with proper WITH CHECK clause
DROP POLICY IF EXISTS "Admins can manage groups" ON public.student_groups;

CREATE POLICY "Admins can manage groups" 
ON public.student_groups 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
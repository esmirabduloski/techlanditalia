-- Drop the existing policy that checks profiles.role (which doesn't work because profiles only allows parent/student)
DROP POLICY IF EXISTS "Teachers can view all comments" ON public.student_comments;

-- Create a new policy that checks user_roles table correctly
CREATE POLICY "Teachers can view all comments" 
ON public.student_comments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'teacher'::app_role)
);
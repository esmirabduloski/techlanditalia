
-- Function to check if a teacher teaches any student in a given group
CREATE OR REPLACE FUNCTION public.teacher_teaches_student_in_group(_teacher_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students gs
    WHERE gs.group_id = _group_id
    AND public.is_teacher_of_student(_teacher_id, gs.student_id)
  )
$$;

-- Allow teachers to see all group memberships of students they teach
CREATE POLICY "Teachers can view all memberships of their students"
ON public.group_students
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), student_id));

-- Allow teachers to see groups that contain students they teach
CREATE POLICY "Teachers can view groups of their students"
ON public.student_groups
FOR SELECT
USING (public.teacher_teaches_student_in_group(auth.uid(), id));

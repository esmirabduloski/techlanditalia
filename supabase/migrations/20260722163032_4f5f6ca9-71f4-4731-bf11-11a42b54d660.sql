CREATE OR REPLACE FUNCTION public.is_parent_of_teacher(_parent_id uuid, _teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles child
    JOIN public.group_students gs ON gs.student_id = child.id
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE child.parent_id = _parent_id
      AND sg.teacher_id = _teacher_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_parent_of_teacher(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_parent_of_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of_teacher(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Parents can view children teachers profiles" ON public.profiles;
CREATE POLICY "Parents can view children teachers profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_parent_of_teacher(auth.uid(), id));
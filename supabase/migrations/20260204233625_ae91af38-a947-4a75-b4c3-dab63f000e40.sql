-- Fix infinite recursion in profiles RLS by creating helper functions
-- The issue: "Teachers can view students in their groups" on profiles
-- references group_students, which has policies that reference profiles via is_parent_of

-- Create a security definer function to check if a teacher can view a student
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = _student_id
      AND sg.teacher_id = _teacher_id
  )
$$;

-- Drop and recreate the problematic policy on profiles
DROP POLICY IF EXISTS "Teachers can view students in their groups" ON public.profiles;
CREATE POLICY "Teachers can view students in their groups"
ON public.profiles
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), id));
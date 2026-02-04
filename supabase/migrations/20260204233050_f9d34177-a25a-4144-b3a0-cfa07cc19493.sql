-- Allow parents/students to read the group record (student_groups) for groups they belong to.
-- This is required for embedded selects like group_lesson_schedule -> group:group_id (...) to not return null.

-- Parents
DROP POLICY IF EXISTS "Parents can view children groups" ON public.student_groups;
CREATE POLICY "Parents can view children groups"
ON public.student_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_students gs
    WHERE gs.group_id = student_groups.id
      AND gs.student_id IN (SELECT public.get_children_ids(auth.uid()))
  )
);

-- Students
DROP POLICY IF EXISTS "Students can view their own groups" ON public.student_groups;
CREATE POLICY "Students can view their own groups"
ON public.student_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_students gs
    WHERE gs.group_id = student_groups.id
      AND gs.student_id = auth.uid()
  )
);
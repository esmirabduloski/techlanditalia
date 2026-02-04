-- Add RLS policy for parents to view their children's group memberships
CREATE POLICY "Parents can view children group memberships"
ON public.group_students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = group_students.student_id
    AND profiles.parent_id = auth.uid()
  )
);

-- Add RLS policy for parents to view lesson schedule for their children's groups
CREATE POLICY "Parents can view children lesson schedule"
ON public.group_lesson_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_students gs
    JOIN profiles p ON p.id = gs.student_id
    WHERE gs.group_id = group_lesson_schedule.group_id
    AND p.parent_id = auth.uid()
  )
);

-- Add RLS policy for parents to view their children's group attendance
CREATE POLICY "Parents can view children group attendance"
ON public.group_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = group_attendance.student_id
    AND profiles.parent_id = auth.uid()
  )
);

-- Add RLS policy for students to view their own group memberships
CREATE POLICY "Students can view their own group memberships"
ON public.group_students
FOR SELECT
USING (auth.uid() = student_id);

-- Add RLS policy for students to view their own lesson schedule
CREATE POLICY "Students can view their own lesson schedule"
ON public.group_lesson_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_students gs
    WHERE gs.group_id = group_lesson_schedule.group_id
    AND gs.student_id = auth.uid()
  )
);

-- Add RLS policy for students to view their own group attendance
CREATE POLICY "Students can view their own group attendance"
ON public.group_attendance
FOR SELECT
USING (auth.uid() = student_id);
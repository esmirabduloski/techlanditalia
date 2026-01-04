-- Allow teachers to view profiles of students in their assigned groups
CREATE POLICY "Teachers can view students in their groups"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = profiles.id 
    AND sg.teacher_id = auth.uid()
  )
);

-- Allow teachers to view group_students for their assigned groups
CREATE POLICY "Teachers can view students in assigned groups"
ON public.group_students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM student_groups sg
    WHERE sg.id = group_students.group_id 
    AND sg.teacher_id = auth.uid()
  )
);
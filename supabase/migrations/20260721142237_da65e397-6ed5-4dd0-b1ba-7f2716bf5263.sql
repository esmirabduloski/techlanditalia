
-- Allow students to view their teachers' profiles
CREATE POLICY "Students can view their teachers profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = auth.uid() AND sg.teacher_id = profiles.id
  )
);

-- Allow parents to view their children's teachers' profiles
CREATE POLICY "Parents can view children teachers profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    JOIN profiles ch ON ch.id = gs.student_id
    WHERE ch.parent_id = auth.uid() AND sg.teacher_id = profiles.id
  )
);

-- Allow students/parents to read teacher_courses of their teachers (for course chips)
CREATE POLICY "Students can view their teachers courses"
ON public.teacher_courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = auth.uid() AND sg.teacher_id = teacher_courses.teacher_id
  )
  OR EXISTS (
    SELECT 1 FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    JOIN profiles ch ON ch.id = gs.student_id
    WHERE ch.parent_id = auth.uid() AND sg.teacher_id = teacher_courses.teacher_id
  )
);

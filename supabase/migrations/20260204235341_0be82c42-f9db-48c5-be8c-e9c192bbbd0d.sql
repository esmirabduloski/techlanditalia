-- =============================================================
-- FIX: Infinite recursion in RLS policies for parent dashboard
-- =============================================================

-- 1) Create helper functions with SECURITY DEFINER to break recursion cycles

-- Check if teacher is assigned to a group
CREATE OR REPLACE FUNCTION public.is_teacher_of_group(_teacher_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_groups
    WHERE id = _group_id
      AND teacher_id = _teacher_id
  )
$$;

-- Check if student is in a group
CREATE OR REPLACE FUNCTION public.is_student_in_group(_student_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students
    WHERE group_id = _group_id
      AND student_id = _student_id
  )
$$;

-- Check if parent has a child in a group
CREATE OR REPLACE FUNCTION public.is_parent_of_group(_parent_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students gs
    JOIN public.profiles p ON gs.student_id = p.id
    WHERE gs.group_id = _group_id
      AND p.parent_id = _parent_id
  )
$$;

-- =============================================================
-- 2) Fix group_students policies (remove reference to student_groups)
-- =============================================================

DROP POLICY IF EXISTS "Teachers can view group students" ON public.group_students;
DROP POLICY IF EXISTS "Teachers can view students in assigned groups" ON public.group_students;

CREATE POLICY "Teachers can view group students"
ON public.group_students
FOR SELECT
USING (public.is_teacher_of_group(auth.uid(), group_id));

-- =============================================================
-- 3) Fix student_groups policies (remove reference to group_students)
-- =============================================================

DROP POLICY IF EXISTS "Parents can view children groups" ON public.student_groups;
DROP POLICY IF EXISTS "Students can view their own groups" ON public.student_groups;

CREATE POLICY "Parents can view children groups"
ON public.student_groups
FOR SELECT
USING (public.is_parent_of_group(auth.uid(), id));

CREATE POLICY "Students can view their own groups"
ON public.student_groups
FOR SELECT
USING (public.is_student_in_group(auth.uid(), id));

-- =============================================================
-- 4) Fix group_lesson_schedule policies
-- =============================================================

DROP POLICY IF EXISTS "Parents can view children lesson schedule" ON public.group_lesson_schedule;
DROP POLICY IF EXISTS "Students can view their own lesson schedule" ON public.group_lesson_schedule;
DROP POLICY IF EXISTS "Teachers can view schedule for assigned groups" ON public.group_lesson_schedule;
DROP POLICY IF EXISTS "Teachers can update schedule for assigned groups" ON public.group_lesson_schedule;

CREATE POLICY "Parents can view children lesson schedule"
ON public.group_lesson_schedule
FOR SELECT
USING (public.is_parent_of_group(auth.uid(), group_id));

CREATE POLICY "Students can view their own lesson schedule"
ON public.group_lesson_schedule
FOR SELECT
USING (public.is_student_in_group(auth.uid(), group_id));

CREATE POLICY "Teachers can view schedule for assigned groups"
ON public.group_lesson_schedule
FOR SELECT
USING (public.is_teacher_of_group(auth.uid(), group_id));

CREATE POLICY "Teachers can update schedule for assigned groups"
ON public.group_lesson_schedule
FOR UPDATE
USING (public.is_teacher_of_group(auth.uid(), group_id));

-- =============================================================
-- 5) Fix group_attendance policies
-- =============================================================

DROP POLICY IF EXISTS "Teachers can manage attendance for assigned groups" ON public.group_attendance;

CREATE POLICY "Teachers can manage attendance for assigned groups"
ON public.group_attendance
FOR ALL
USING (public.is_teacher_of_group(auth.uid(), group_id));
-- Create a security definer function to check if a user is the parent of a student
-- This avoids RLS recursion when checking parent_id in profiles table
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _student_id
      AND parent_id = _parent_id
  )
$$;

-- Create a function to get all children IDs for a parent
CREATE OR REPLACE FUNCTION public.get_children_ids(_parent_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE parent_id = _parent_id
$$;

-- Now update all policies to use the security definer function

-- 1. Update profiles policy
DROP POLICY IF EXISTS "Parents can view children profiles" ON public.profiles;
CREATE POLICY "Parents can view children profiles"
ON public.profiles
FOR SELECT
USING (parent_id = auth.uid());

-- 2. Update enrollments policy
DROP POLICY IF EXISTS "Parents can view children enrollments" ON public.enrollments;
CREATE POLICY "Parents can view children enrollments"
ON public.enrollments
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 3. Update attendance policy
DROP POLICY IF EXISTS "Parents can view children attendance" ON public.attendance;
CREATE POLICY "Parents can view children attendance"
ON public.attendance
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 4. Update group_attendance policy
DROP POLICY IF EXISTS "Parents can view children group attendance" ON public.group_attendance;
CREATE POLICY "Parents can view children group attendance"
ON public.group_attendance
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 5. Update group_students policy
DROP POLICY IF EXISTS "Parents can view children group memberships" ON public.group_students;
CREATE POLICY "Parents can view children group memberships"
ON public.group_students
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 6. Update group_lesson_schedule policy
DROP POLICY IF EXISTS "Parents can view children lesson schedule" ON public.group_lesson_schedule;
CREATE POLICY "Parents can view children lesson schedule"
ON public.group_lesson_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_students gs
    WHERE gs.group_id = group_lesson_schedule.group_id
    AND gs.student_id IN (SELECT public.get_children_ids(auth.uid()))
  )
);

-- 7. Update homework_submissions policy
DROP POLICY IF EXISTS "Parents can view children submissions" ON public.homework_submissions;
CREATE POLICY "Parents can view children submissions"
ON public.homework_submissions
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 8. Update lesson_progress policy
DROP POLICY IF EXISTS "Parents can view children progress" ON public.lesson_progress;
CREATE POLICY "Parents can view children progress"
ON public.lesson_progress
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 9. Update streak_bonuses policy
DROP POLICY IF EXISTS "Parents can view children streak bonuses" ON public.streak_bonuses;
CREATE POLICY "Parents can view children streak bonuses"
ON public.streak_bonuses
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 10. Update student_comments policy
DROP POLICY IF EXISTS "Parents can view parent/student visible comments" ON public.student_comments;
CREATE POLICY "Parents can view parent/student visible comments"
ON public.student_comments
FOR SELECT
USING (
  public.is_parent_of(auth.uid(), student_id)
  AND (('parent'::text = ANY (visibility)) OR ('student'::text = ANY (visibility)))
);

-- 11. Update student_streaks policy
DROP POLICY IF EXISTS "Parents can view children streaks" ON public.student_streaks;
CREATE POLICY "Parents can view children streaks"
ON public.student_streaks
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 12. Update task_progress policy
DROP POLICY IF EXISTS "Parents can view children task progress" ON public.task_progress;
CREATE POLICY "Parents can view children task progress"
ON public.task_progress
FOR SELECT
USING (public.is_parent_of(auth.uid(), student_id));

-- 13. Update user_achievements policy
DROP POLICY IF EXISTS "Parents can view children achievements" ON public.user_achievements;
CREATE POLICY "Parents can view children achievements"
ON public.user_achievements
FOR SELECT
USING (public.is_parent_of(auth.uid(), user_id));
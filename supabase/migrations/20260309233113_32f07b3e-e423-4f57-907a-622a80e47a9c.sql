
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  _filter_type text DEFAULT 'global',
  _filter_id uuid DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  full_name text,
  avatar_id integer,
  total_points integer,
  role text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ROW_NUMBER() OVER (ORDER BY p.total_points DESC, p.created_at ASC) as rank,
    p.id as user_id,
    p.full_name,
    p.avatar_id,
    p.total_points,
    p.role
  FROM public.profiles p
  WHERE p.role = 'student'
    AND (
      _filter_type = 'global'
      OR (
        _filter_type = 'course' AND EXISTS (
          SELECT 1 FROM public.enrollments e 
          WHERE e.student_id = p.id AND e.course_id = _filter_id AND e.status = 'active'
        )
      )
      OR (
        _filter_type = 'group' AND EXISTS (
          SELECT 1 FROM public.group_students gs 
          WHERE gs.student_id = p.id AND gs.group_id = _filter_id
        )
      )
    )
  ORDER BY p.total_points DESC, p.created_at ASC
  LIMIT _limit;
$$;

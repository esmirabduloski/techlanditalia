
-- 1) Rate-limit trigger for public analytics ingestion (session-scoped)
CREATE OR REPLACE FUNCTION public.enforce_analytics_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  max_per_minute constant int := 120;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM public.%I WHERE session_id = $1 AND created_at > now() - interval ''1 minute''',
    TG_TABLE_NAME
  )
  INTO recent_count
  USING NEW.session_id;

  IF recent_count >= max_per_minute THEN
    RAISE EXCEPTION 'analytics_rate_limit_exceeded'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_events_rate_limit ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_rate_limit
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit();

DROP TRIGGER IF EXISTS trg_page_views_rate_limit ON public.page_views;
CREATE TRIGGER trg_page_views_rate_limit
  BEFORE INSERT ON public.page_views
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit();

DROP TRIGGER IF EXISTS trg_conversion_funnels_rate_limit ON public.conversion_funnels;
CREATE TRIGGER trg_conversion_funnels_rate_limit
  BEFORE INSERT ON public.conversion_funnels
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit();

-- 2) Restrict profiles SELECT/UPDATE policies to authenticated role only
-- (removes exposure to the anon role and tightens realtime broadcasts)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Parents can view children profiles" ON public.profiles;
CREATE POLICY "Parents can view children profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Students can view their teachers profiles" ON public.profiles;
CREATE POLICY "Students can view their teachers profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = auth.uid() AND sg.teacher_id = profiles.id
  ));

DROP POLICY IF EXISTS "Teachers can view students in their groups" ON public.profiles;
CREATE POLICY "Teachers can view students in their groups"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_teacher_of_student(auth.uid(), id));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student' AND parent_id IS NULL);

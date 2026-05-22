
-- 1. Prevent privilege escalation via profiles.role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Non sei autorizzato a modificare il ruolo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_role_self_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 2. Restrict scheduled_lessons SELECT to related users
DROP POLICY IF EXISTS "Authenticated users can view scheduled_lessons" ON public.scheduled_lessons;
CREATE POLICY "Authorized users can view scheduled lessons"
ON public.scheduled_lessons
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_enrolled_in_course(auth.uid(), course_id)
  OR public.is_parent_of_enrolled(auth.uid(), course_id)
  OR public.is_teacher_of_course(auth.uid(), course_id)
);

-- 3. Restrict teacher access to student_comments to their own students
DROP POLICY IF EXISTS "Teachers can view all comments" ON public.student_comments;
CREATE POLICY "Teachers can view comments for their students"
ON public.student_comments
FOR SELECT
USING (public.is_teacher_of_student(auth.uid(), student_id));

-- 4. Harden realtime.messages topic authorization (prevent UUID substring bypass)
DROP POLICY IF EXISTS "Users can subscribe to own channels" ON realtime.messages;
CREATE POLICY "Users can subscribe to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR realtime.topic() = auth.uid()::text
  OR realtime.topic() LIKE auth.uid()::text || ':%'
  OR realtime.topic() LIKE 'user-' || auth.uid()::text
  OR realtime.topic() LIKE 'user-' || auth.uid()::text || ':%'
);

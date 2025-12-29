-- Function to enroll a user in all courses
CREATE OR REPLACE FUNCTION public.enroll_admin_in_all_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if the new role is 'admin'
  IF NEW.role = 'admin' THEN
    -- Insert enrollment for all courses the admin is not already enrolled in
    INSERT INTO public.enrollments (student_id, course_id, status)
    SELECT NEW.user_id, c.id, 'active'
    FROM public.courses c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.enrollments e 
      WHERE e.student_id = NEW.user_id AND e.course_id = c.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-enroll admins when they get the admin role
CREATE TRIGGER on_admin_role_added
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enroll_admin_in_all_courses();

-- Also create a trigger to enroll admins when new courses are created
CREATE OR REPLACE FUNCTION public.enroll_admins_in_new_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enroll all admins in the new course
  INSERT INTO public.enrollments (student_id, course_id, status)
  SELECT ur.user_id, NEW.id, 'active'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.enrollments e 
    WHERE e.student_id = ur.user_id AND e.course_id = NEW.id
  );
  RETURN NEW;
END;
$$;

-- Trigger for new courses
CREATE TRIGGER on_course_created_enroll_admins
  AFTER INSERT ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.enroll_admins_in_new_course();

-- Now enroll all existing admins in all courses they're not already enrolled in
INSERT INTO public.enrollments (student_id, course_id, status)
SELECT ur.user_id, c.id, 'active'
FROM public.user_roles ur
CROSS JOIN public.courses c
WHERE ur.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM public.enrollments e 
  WHERE e.student_id = ur.user_id AND e.course_id = c.id
);
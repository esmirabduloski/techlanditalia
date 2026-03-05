
-- Create a trigger to prevent a student from being in 2 groups of the same course
CREATE OR REPLACE FUNCTION public.check_student_course_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_course_id uuid;
  existing_group_title text;
BEGIN
  -- Get the course_id for the group being inserted into
  SELECT course_id INTO new_course_id
  FROM public.student_groups
  WHERE id = NEW.group_id;

  -- Check if this student is already in another group for the same course
  SELECT sg.title INTO existing_group_title
  FROM public.group_students gs
  JOIN public.student_groups sg ON sg.id = gs.group_id
  WHERE gs.student_id = NEW.student_id
    AND sg.course_id = new_course_id
    AND gs.group_id != NEW.group_id;

  IF existing_group_title IS NOT NULL THEN
    RAISE EXCEPTION 'Lo studente è già iscritto a un gruppo per questo corso: %', existing_group_title;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger
DROP TRIGGER IF EXISTS check_student_course_uniqueness_trigger ON public.group_students;
CREATE TRIGGER check_student_course_uniqueness_trigger
  BEFORE INSERT ON public.group_students
  FOR EACH ROW
  EXECUTE FUNCTION public.check_student_course_uniqueness();

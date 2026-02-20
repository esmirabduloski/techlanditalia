
-- Auto-generate lesson schedule when a group is created with start_date and lesson_days
CREATE OR REPLACE FUNCTION public.auto_generate_lesson_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_date_iter date;
  lesson_count integer := 0;
  max_lessons_val integer;
  day_of_week integer;
BEGIN
  -- Only generate if start_date and lesson_days are set
  IF NEW.start_date IS NULL OR NEW.lesson_days IS NULL OR array_length(NEW.lesson_days, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  max_lessons_val := COALESCE(NEW.max_lessons, 32);
  current_date_iter := NEW.start_date;

  -- Iterate through dates to find lesson days
  WHILE lesson_count < max_lessons_val LOOP
    day_of_week := EXTRACT(DOW FROM current_date_iter)::integer;
    
    IF day_of_week = ANY(NEW.lesson_days) THEN
      lesson_count := lesson_count + 1;
      INSERT INTO public.group_lesson_schedule (group_id, lesson_number, lesson_date, lesson_title, lesson_time)
      VALUES (
        NEW.id,
        lesson_count,
        current_date_iter,
        'M' || CEIL(lesson_count::numeric / 4) || 'L' || ((lesson_count - 1) % 4 + 1),
        NEW.lesson_time
      );
    END IF;
    
    current_date_iter := current_date_iter + 1;
    
    -- Safety: don't iterate more than 2 years
    IF current_date_iter > NEW.start_date + interval '730 days' THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on student_groups INSERT
CREATE TRIGGER auto_generate_schedule_on_group_create
AFTER INSERT ON public.student_groups
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_lesson_schedule();

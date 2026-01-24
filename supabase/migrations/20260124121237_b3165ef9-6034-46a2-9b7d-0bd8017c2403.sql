-- =====================================================
-- FIX STREAK CALCULATIONS AND HOMEWORK DUE DATES
-- =====================================================

-- 1. Create table to store homework due dates per group
CREATE TABLE IF NOT EXISTS public.homework_group_deadlines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  due_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(homework_id, group_id)
);

-- Enable RLS
ALTER TABLE public.homework_group_deadlines ENABLE ROW LEVEL SECURITY;

-- RLS policies for homework_group_deadlines
CREATE POLICY "Anyone can view homework deadlines" 
ON public.homework_group_deadlines 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage homework deadlines" 
ON public.homework_group_deadlines 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create function to auto-generate homework deadlines when lesson schedule is created/updated
CREATE OR REPLACE FUNCTION public.generate_homework_deadlines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hw RECORD;
  lesson_rec RECORD;
  deadline_date timestamptz;
BEGIN
  -- Get the course for this group
  -- For each homework in lessons of this course, create a deadline based on the group's lesson schedule
  FOR lesson_rec IN 
    SELECT l.id as lesson_id, l.lesson_number, gls.lesson_date
    FROM lessons l
    JOIN student_groups sg ON sg.course_id = l.course_id
    JOIN group_lesson_schedule gls ON gls.group_id = sg.id AND gls.lesson_number = l.lesson_number
    WHERE sg.id = NEW.group_id
  LOOP
    FOR hw IN SELECT id FROM homework WHERE lesson_id = lesson_rec.lesson_id
    LOOP
      -- Set deadline to 23:59 of the day BEFORE the next lesson (or 7 days after if no next lesson)
      deadline_date := (lesson_rec.lesson_date + interval '7 days')::date + interval '23 hours 59 minutes';
      
      INSERT INTO homework_group_deadlines (homework_id, group_id, due_date)
      VALUES (hw.id, NEW.group_id, deadline_date)
      ON CONFLICT (homework_id, group_id) 
      DO UPDATE SET due_date = EXCLUDED.due_date;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to generate deadlines when lesson schedule is created
CREATE TRIGGER on_lesson_schedule_created
  AFTER INSERT ON public.group_lesson_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_homework_deadlines();

-- 3. Drop old triggers and recreate for group_attendance
DROP TRIGGER IF EXISTS on_attendance_marked ON public.attendance;

-- 4. Create improved attendance streak function for group_attendance
CREATE OR REPLACE FUNCTION public.update_group_attendance_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  last_lesson INTEGER;
  lesson_date DATE;
  prev_lesson_status TEXT;
BEGIN
  -- Get the lesson date from group_lesson_schedule
  SELECT gls.lesson_date INTO lesson_date
  FROM group_lesson_schedule gls
  WHERE gls.group_id = NEW.group_id AND gls.lesson_number = NEW.lesson_number;
  
  -- Handle unexcused absence - reset streak
  IF NEW.status = 'absent' THEN
    UPDATE student_streaks
    SET attendance_streak = 0,
        updated_at = now()
    WHERE student_id = NEW.student_id;
    
    -- Create record if doesn't exist
    IF NOT FOUND THEN
      INSERT INTO student_streaks (student_id, attendance_streak, last_attendance_date, best_attendance_streak)
      VALUES (NEW.student_id, 0, lesson_date, 0);
    END IF;
    RETURN NEW;
  END IF;
  
  -- For present students, check streak
  IF NEW.status = 'present' THEN
    -- Get current streak data
    SELECT attendance_streak, best_attendance_streak, 
           COALESCE((SELECT MAX(lesson_number) FROM group_attendance 
                     WHERE student_id = NEW.student_id AND group_id = NEW.group_id 
                     AND lesson_number < NEW.lesson_number AND status = 'present'), 0)
    INTO current_streak, best_streak, last_lesson
    FROM student_streaks
    WHERE student_id = NEW.student_id;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
      INSERT INTO student_streaks (student_id, attendance_streak, last_attendance_date, best_attendance_streak)
      VALUES (NEW.student_id, 1, lesson_date, 1);
      RETURN NEW;
    END IF;
    
    -- Check if there was an unexcused absence between last attended lesson and this one
    SELECT status INTO prev_lesson_status
    FROM group_attendance
    WHERE student_id = NEW.student_id 
      AND group_id = NEW.group_id 
      AND lesson_number = NEW.lesson_number - 1;
    
    -- If previous lesson was absent (unexcused), streak was already reset
    -- If previous lesson was present or excused, increment streak
    IF prev_lesson_status IS NULL OR prev_lesson_status = 'present' OR prev_lesson_status = 'excused' THEN
      current_streak := COALESCE(current_streak, 0) + 1;
    ELSE
      current_streak := 1;
    END IF;
    
    -- Update best streak if current is higher
    IF current_streak > COALESCE(best_streak, 0) THEN
      best_streak := current_streak;
    END IF;
    
    -- Update the streak record
    UPDATE student_streaks
    SET attendance_streak = current_streak,
        last_attendance_date = lesson_date,
        best_attendance_streak = best_streak,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for group_attendance
CREATE TRIGGER on_group_attendance_marked
  AFTER INSERT OR UPDATE ON public.group_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_attendance_streak();

-- 5. Improve homework streak - count consecutive on-time submissions
CREATE OR REPLACE FUNCTION public.update_homework_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  last_hw_id UUID;
  submission_date DATE;
  was_on_time BOOLEAN;
  student_group_id UUID;
  hw_deadline TIMESTAMPTZ;
BEGIN
  submission_date := DATE(NEW.submitted_at);
  
  -- Get the student's group
  SELECT gs.group_id INTO student_group_id
  FROM group_students gs
  WHERE gs.student_id = NEW.student_id
  LIMIT 1;
  
  -- Check if submission was on time (using group-specific deadline or global deadline)
  SELECT COALESCE(hgd.due_date, h.due_date) INTO hw_deadline
  FROM homework h
  LEFT JOIN homework_group_deadlines hgd ON hgd.homework_id = h.id AND hgd.group_id = student_group_id
  WHERE h.id = NEW.homework_id;
  
  -- Determine if on-time (if no deadline, consider on-time)
  was_on_time := hw_deadline IS NULL OR NEW.submitted_at <= hw_deadline;
  
  -- Get current streak data
  SELECT homework_streak, best_homework_streak, last_homework_date
  INTO current_streak, best_streak
  FROM student_streaks
  WHERE student_id = NEW.student_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO student_streaks (student_id, homework_streak, last_homework_date, best_homework_streak)
    VALUES (NEW.student_id, CASE WHEN was_on_time THEN 1 ELSE 0 END, submission_date, CASE WHEN was_on_time THEN 1 ELSE 0 END);
    RETURN NEW;
  END IF;
  
  -- If submission is late, reset streak
  IF NOT was_on_time THEN
    UPDATE student_streaks
    SET homework_streak = 0,
        last_homework_date = submission_date,
        updated_at = now()
    WHERE student_id = NEW.student_id;
    RETURN NEW;
  END IF;
  
  -- On-time submission - increment streak
  current_streak := COALESCE(current_streak, 0) + 1;
  
  -- Update best streak if current is higher
  IF current_streak > COALESCE(best_streak, 0) THEN
    best_streak := current_streak;
  END IF;
  
  -- Update the streak record
  UPDATE student_streaks
  SET homework_streak = current_streak,
      last_homework_date = submission_date,
      best_homework_streak = best_streak,
      updated_at = now()
  WHERE student_id = NEW.student_id;
  
  RETURN NEW;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_homework_group_deadlines_homework ON public.homework_group_deadlines(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_group_deadlines_group ON public.homework_group_deadlines(group_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_student ON public.group_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_streak ON public.group_attendance(student_id, group_id, lesson_number);
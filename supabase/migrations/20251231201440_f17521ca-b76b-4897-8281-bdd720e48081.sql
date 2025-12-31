
-- Create scheduled_lessons table for planned lessons with dates
CREATE TABLE public.scheduled_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create attendance table for tracking student presence
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_lesson_id UUID NOT NULL REFERENCES public.scheduled_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent_unexcused', 'absent_excused')),
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id),
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, scheduled_lesson_id)
);

-- Create student_streaks table for caching streak data
CREATE TABLE public.student_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  homework_streak INTEGER DEFAULT 0,
  attendance_streak INTEGER DEFAULT 0,
  last_homework_date DATE,
  last_attendance_date DATE,
  best_homework_streak INTEGER DEFAULT 0,
  best_attendance_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.scheduled_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_lessons
CREATE POLICY "Admins can manage scheduled_lessons"
ON public.scheduled_lessons FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view scheduled_lessons"
ON public.scheduled_lessons FOR SELECT
USING (true);

-- RLS Policies for attendance
CREATE POLICY "Admins can manage all attendance"
ON public.attendance FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Parents can view children attendance"
ON public.attendance FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = attendance.student_id
  AND profiles.parent_id = auth.uid()
));

-- RLS Policies for student_streaks
CREATE POLICY "Admins can manage all streaks"
ON public.student_streaks FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their streaks"
ON public.student_streaks FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Parents can view children streaks"
ON public.student_streaks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = student_streaks.student_id
  AND profiles.parent_id = auth.uid()
));

-- Function to update homework streak when a submission is made
CREATE OR REPLACE FUNCTION public.update_homework_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  last_date DATE;
  submission_date DATE;
BEGIN
  submission_date := DATE(NEW.submitted_at);
  
  -- Get current streak data
  SELECT homework_streak, best_homework_streak, last_homework_date
  INTO current_streak, best_streak, last_date
  FROM student_streaks
  WHERE student_id = NEW.student_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO student_streaks (student_id, homework_streak, last_homework_date, best_homework_streak)
    VALUES (NEW.student_id, 1, submission_date, 1);
    RETURN NEW;
  END IF;
  
  -- If same day, don't update streak
  IF last_date = submission_date THEN
    RETURN NEW;
  END IF;
  
  -- If consecutive day, increment streak
  IF last_date = submission_date - INTERVAL '1 day' THEN
    current_streak := current_streak + 1;
  -- If gap of more than 1 day, reset streak
  ELSIF last_date < submission_date - INTERVAL '1 day' THEN
    current_streak := 1;
  END IF;
  
  -- Update best streak if current is higher
  IF current_streak > best_streak THEN
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

-- Function to update attendance streak when attendance is marked
CREATE OR REPLACE FUNCTION public.update_attendance_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  last_date DATE;
  lesson_date DATE;
BEGIN
  -- Get the lesson date
  SELECT sl.lesson_date INTO lesson_date
  FROM scheduled_lessons sl
  WHERE sl.id = NEW.scheduled_lesson_id;
  
  -- Only process if student is present or excused (excused doesn't break streak)
  IF NEW.status = 'absent_unexcused' THEN
    -- Reset streak on unexcused absence
    UPDATE student_streaks
    SET attendance_streak = 0,
        updated_at = now()
    WHERE student_id = NEW.student_id;
    RETURN NEW;
  END IF;
  
  -- Get current streak data
  SELECT attendance_streak, best_attendance_streak, last_attendance_date
  INTO current_streak, best_streak, last_date
  FROM student_streaks
  WHERE student_id = NEW.student_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO student_streaks (student_id, attendance_streak, last_attendance_date, best_attendance_streak)
    VALUES (NEW.student_id, 1, lesson_date, 1);
    RETURN NEW;
  END IF;
  
  -- If same date, don't update
  IF last_date = lesson_date THEN
    RETURN NEW;
  END IF;
  
  -- Increment streak (we count consecutive lessons, not days)
  current_streak := COALESCE(current_streak, 0) + 1;
  
  -- Update best streak if current is higher
  IF current_streak > best_streak THEN
    best_streak := current_streak;
  END IF;
  
  -- Update the streak record
  UPDATE student_streaks
  SET attendance_streak = current_streak,
      last_attendance_date = lesson_date,
      best_attendance_streak = best_streak,
      updated_at = now()
  WHERE student_id = NEW.student_id;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_homework_submission
  AFTER INSERT ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_homework_streak();

CREATE TRIGGER on_attendance_marked
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_streak();

-- Add indexes for performance
CREATE INDEX idx_scheduled_lessons_course ON public.scheduled_lessons(course_id);
CREATE INDEX idx_scheduled_lessons_date ON public.scheduled_lessons(lesson_date);
CREATE INDEX idx_attendance_student ON public.attendance(student_id);
CREATE INDEX idx_attendance_lesson ON public.attendance(scheduled_lesson_id);
CREATE INDEX idx_student_streaks_student ON public.student_streaks(student_id);

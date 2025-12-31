
-- Create badges table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL DEFAULT '🏆',
  category text NOT NULL DEFAULT 'general',
  requirement_type text NOT NULL, -- 'lessons_completed', 'homework_completed', 'points_earned', 'course_completed', 'tasks_completed'
  requirement_value integer NOT NULL,
  requirement_course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  points_reward integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create student_comments table
CREATE TABLE public.student_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  visibility text[] NOT NULL DEFAULT ARRAY['parent', 'teacher'], -- 'parent', 'teacher', 'student'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add grade column to homework_submissions
ALTER TABLE public.homework_submissions 
ADD COLUMN IF NOT EXISTS grade integer CHECK (grade >= 0 AND grade <= 100);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_comments ENABLE ROW LEVEL SECURITY;

-- Badges policies (anyone can view)
CREATE POLICY "Anyone can view badges"
ON public.badges FOR SELECT
USING (true);

CREATE POLICY "Admins can manage badges"
ON public.badges FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- User achievements policies
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Parents can view children achievements"
ON public.user_achievements FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = user_achievements.user_id 
  AND profiles.parent_id = auth.uid()
));

CREATE POLICY "Admins can manage all achievements"
ON public.user_achievements FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Student comments policies
CREATE POLICY "Admins can manage all comments"
ON public.student_comments FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view all comments"
ON public.student_comments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

CREATE POLICY "Parents can view parent/student visible comments"
ON public.student_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = student_comments.student_id 
    AND profiles.parent_id = auth.uid()
  )
  AND ('parent' = ANY(visibility) OR 'student' = ANY(visibility))
);

CREATE POLICY "Students can view their student visible comments"
ON public.student_comments FOR SELECT
USING (
  auth.uid() = student_id 
  AND 'student' = ANY(visibility)
);

-- Function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_record RECORD;
  student_lessons_count INTEGER;
  student_homework_count INTEGER;
  student_tasks_count INTEGER;
  student_points INTEGER;
  course_lessons_count INTEGER;
  student_course_lessons INTEGER;
BEGIN
  -- Get student stats
  SELECT COUNT(*) INTO student_lessons_count 
  FROM lesson_progress WHERE student_id = NEW.student_id;
  
  SELECT COUNT(*) INTO student_homework_count 
  FROM homework_submissions WHERE student_id = NEW.student_id AND status = 'graded';
  
  SELECT COUNT(*) INTO student_tasks_count 
  FROM task_progress WHERE student_id = NEW.student_id;
  
  SELECT COALESCE(total_points, 0) INTO student_points 
  FROM profiles WHERE id = NEW.student_id;

  -- Check all badges
  FOR badge_record IN SELECT * FROM badges LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = NEW.student_id AND badge_id = badge_record.id) THEN
      CONTINUE;
    END IF;

    -- Check requirement based on type
    IF badge_record.requirement_type = 'lessons_completed' THEN
      IF badge_record.requirement_course_id IS NOT NULL THEN
        -- Course-specific lessons
        SELECT COUNT(*) INTO student_course_lessons
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        WHERE lp.student_id = NEW.student_id AND l.course_id = badge_record.requirement_course_id;
        
        IF student_course_lessons >= badge_record.requirement_value THEN
          INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
          UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
        END IF;
      ELSE
        -- General lessons
        IF student_lessons_count >= badge_record.requirement_value THEN
          INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
          UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
        END IF;
      END IF;
    ELSIF badge_record.requirement_type = 'homework_completed' THEN
      IF student_homework_count >= badge_record.requirement_value THEN
        INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
        UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
      END IF;
    ELSIF badge_record.requirement_type = 'tasks_completed' THEN
      IF student_tasks_count >= badge_record.requirement_value THEN
        INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
        UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
      END IF;
    ELSIF badge_record.requirement_type = 'points_earned' THEN
      IF student_points >= badge_record.requirement_value THEN
        INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
        UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
      END IF;
    ELSIF badge_record.requirement_type = 'course_completed' THEN
      IF badge_record.requirement_course_id IS NOT NULL THEN
        SELECT total_lessons INTO course_lessons_count FROM courses WHERE id = badge_record.requirement_course_id;
        SELECT COUNT(*) INTO student_course_lessons
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        WHERE lp.student_id = NEW.student_id AND l.course_id = badge_record.requirement_course_id;
        
        IF student_course_lessons >= course_lessons_count THEN
          INSERT INTO user_achievements (user_id, badge_id) VALUES (NEW.student_id, badge_record.id);
          UPDATE profiles SET total_points = total_points + badge_record.points_reward WHERE id = NEW.student_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create triggers for badge checking
CREATE TRIGGER check_badges_on_lesson_progress
AFTER INSERT ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.check_and_award_badges();

CREATE TRIGGER check_badges_on_homework_submission
AFTER INSERT OR UPDATE ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.check_and_award_badges();

CREATE TRIGGER check_badges_on_task_progress
AFTER INSERT ON public.task_progress
FOR EACH ROW EXECUTE FUNCTION public.check_and_award_badges();

-- Update trigger for student_comments
CREATE TRIGGER update_student_comments_updated_at
BEFORE UPDATE ON public.student_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate graded homework points
CREATE OR REPLACE FUNCTION public.calculate_graded_homework_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hw_max_points INTEGER;
BEGIN
  -- Only calculate if grade is set
  IF NEW.grade IS NOT NULL THEN
    SELECT points_reward INTO hw_max_points FROM homework WHERE id = NEW.homework_id;
    NEW.points_earned := ROUND((hw_max_points * NEW.grade::DECIMAL) / 100);
  END IF;
  RETURN NEW;
END;
$$;

-- Replace the existing homework points trigger
DROP TRIGGER IF EXISTS calculate_homework_points_trigger ON public.homework_submissions;
CREATE TRIGGER calculate_graded_homework_points_trigger
BEFORE INSERT OR UPDATE ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.calculate_graded_homework_points();

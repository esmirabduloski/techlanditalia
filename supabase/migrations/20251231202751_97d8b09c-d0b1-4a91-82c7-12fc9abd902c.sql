
-- Create table to track awarded streak bonuses (to avoid duplicates)
CREATE TABLE public.streak_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_type TEXT NOT NULL CHECK (streak_type IN ('homework', 'attendance')),
  milestone INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, streak_type, milestone)
);

-- Enable RLS
ALTER TABLE public.streak_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all streak bonuses"
ON public.streak_bonuses FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their streak bonuses"
ON public.streak_bonuses FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Parents can view children streak bonuses"
ON public.streak_bonuses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = streak_bonuses.student_id
  AND profiles.parent_id = auth.uid()
));

-- Function to check and award streak bonuses
CREATE OR REPLACE FUNCTION public.check_streak_bonuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_homework_streak INTEGER;
  current_attendance_streak INTEGER;
  milestone INTEGER;
  bonus_points INTEGER;
  milestones INTEGER[] := ARRAY[7, 14, 21, 28, 32];
BEGIN
  -- Get current streaks
  SELECT homework_streak, attendance_streak
  INTO current_homework_streak, current_attendance_streak
  FROM student_streaks
  WHERE student_id = NEW.student_id;

  -- Check homework streak milestones
  FOREACH milestone IN ARRAY milestones LOOP
    IF current_homework_streak >= milestone THEN
      -- Calculate bonus points based on milestone
      bonus_points := CASE milestone
        WHEN 7 THEN 100
        WHEN 14 THEN 200
        WHEN 21 THEN 300
        WHEN 28 THEN 400
        WHEN 32 THEN 500
        ELSE 0
      END;

      -- Try to insert bonus (will fail silently if already awarded)
      INSERT INTO streak_bonuses (student_id, streak_type, milestone, points_awarded)
      VALUES (NEW.student_id, 'homework', milestone, bonus_points)
      ON CONFLICT (student_id, streak_type, milestone) DO NOTHING;

      -- If inserted, add points to profile
      IF FOUND THEN
        UPDATE profiles
        SET total_points = total_points + bonus_points
        WHERE id = NEW.student_id;
      END IF;
    END IF;
  END LOOP;

  -- Check attendance streak milestones
  FOREACH milestone IN ARRAY milestones LOOP
    IF current_attendance_streak >= milestone THEN
      -- Calculate bonus points based on milestone
      bonus_points := CASE milestone
        WHEN 7 THEN 100
        WHEN 14 THEN 200
        WHEN 21 THEN 300
        WHEN 28 THEN 400
        WHEN 32 THEN 500
        ELSE 0
      END;

      -- Try to insert bonus (will fail silently if already awarded)
      INSERT INTO streak_bonuses (student_id, streak_type, milestone, points_awarded)
      VALUES (NEW.student_id, 'attendance', milestone, bonus_points)
      ON CONFLICT (student_id, streak_type, milestone) DO NOTHING;

      -- If inserted, add points to profile
      IF FOUND THEN
        UPDATE profiles
        SET total_points = total_points + bonus_points
        WHERE id = NEW.student_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger to check bonuses after streak update
CREATE TRIGGER on_streak_updated
  AFTER INSERT OR UPDATE ON public.student_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_streak_bonuses();

-- Add index for performance
CREATE INDEX idx_streak_bonuses_student ON public.streak_bonuses(student_id);

CREATE OR REPLACE FUNCTION public.check_streak_bonuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_homework_streak INTEGER;
  current_attendance_streak INTEGER;
  v_milestone INTEGER;
  bonus_points INTEGER;
  milestones INTEGER[] := ARRAY[7, 14, 21, 28, 32];
BEGIN
  SELECT homework_streak, attendance_streak
  INTO current_homework_streak, current_attendance_streak
  FROM student_streaks
  WHERE student_id = NEW.student_id;

  FOREACH v_milestone IN ARRAY milestones LOOP
    IF current_homework_streak >= v_milestone THEN
      bonus_points := CASE v_milestone
        WHEN 7 THEN 100 WHEN 14 THEN 200 WHEN 21 THEN 300 WHEN 28 THEN 400 WHEN 32 THEN 500 ELSE 0
      END;
      INSERT INTO streak_bonuses (student_id, streak_type, milestone, points_awarded)
      VALUES (NEW.student_id, 'homework', v_milestone, bonus_points)
      ON CONFLICT (student_id, streak_type, milestone) DO NOTHING;
      IF FOUND THEN
        UPDATE profiles SET total_points = total_points + bonus_points WHERE id = NEW.student_id;
      END IF;
    END IF;
  END LOOP;

  FOREACH v_milestone IN ARRAY milestones LOOP
    IF current_attendance_streak >= v_milestone THEN
      bonus_points := CASE v_milestone
        WHEN 7 THEN 100 WHEN 14 THEN 200 WHEN 21 THEN 300 WHEN 28 THEN 400 WHEN 32 THEN 500 ELSE 0
      END;
      INSERT INTO streak_bonuses (student_id, streak_type, milestone, points_awarded)
      VALUES (NEW.student_id, 'attendance', v_milestone, bonus_points)
      ON CONFLICT (student_id, streak_type, milestone) DO NOTHING;
      IF FOUND THEN
        UPDATE profiles SET total_points = total_points + bonus_points WHERE id = NEW.student_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
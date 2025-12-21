-- Create trigger function to automatically set lesson points from the lessons table
-- This prevents client-side manipulation of points values
CREATE OR REPLACE FUNCTION public.calculate_lesson_points()
RETURNS TRIGGER AS $$
DECLARE
  lesson_points INTEGER;
BEGIN
  -- Get the authoritative points value from the lessons table
  SELECT points_reward INTO lesson_points
  FROM public.lessons
  WHERE id = NEW.lesson_id;
  
  -- Override any client-provided value with the authoritative value
  NEW.points_earned := COALESCE(lesson_points, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for lesson_progress table
DROP TRIGGER IF EXISTS set_lesson_points ON public.lesson_progress;
CREATE TRIGGER set_lesson_points
BEFORE INSERT ON public.lesson_progress
FOR EACH ROW
EXECUTE FUNCTION public.calculate_lesson_points();

-- Create trigger function to automatically set homework points from the homework table
CREATE OR REPLACE FUNCTION public.calculate_homework_points()
RETURNS TRIGGER AS $$
DECLARE
  hw_points INTEGER;
BEGIN
  -- Get the authoritative points value from the homework table
  SELECT points_reward INTO hw_points
  FROM public.homework
  WHERE id = NEW.homework_id;
  
  -- Override any client-provided value with the authoritative value
  NEW.points_earned := COALESCE(hw_points, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for homework_submissions table
DROP TRIGGER IF EXISTS set_homework_points ON public.homework_submissions;
CREATE TRIGGER set_homework_points
BEFORE INSERT ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_homework_points();
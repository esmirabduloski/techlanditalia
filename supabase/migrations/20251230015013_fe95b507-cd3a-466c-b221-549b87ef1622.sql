-- Create table for tracking task completion
CREATE TABLE public.task_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.lesson_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  points_earned INTEGER NOT NULL DEFAULT 0,
  UNIQUE(student_id, task_id)
);

-- Enable Row Level Security
ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;

-- Students can view their own progress
CREATE POLICY "Students can view their task progress"
ON public.task_progress
FOR SELECT
USING (auth.uid() = student_id);

-- Students can insert their own progress
CREATE POLICY "Students can insert their task progress"
ON public.task_progress
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Parents can view children task progress
CREATE POLICY "Parents can view children task progress"
ON public.task_progress
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = task_progress.student_id
  AND profiles.parent_id = auth.uid()
));

-- Admins can manage all task progress
CREATE POLICY "Admins can manage all task progress"
ON public.task_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to calculate points from task
CREATE OR REPLACE FUNCTION public.calculate_task_points()
RETURNS TRIGGER AS $$
DECLARE
  task_points INTEGER;
BEGIN
  SELECT points_reward INTO task_points
  FROM public.lesson_tasks
  WHERE id = NEW.task_id;
  
  NEW.points_earned := COALESCE(task_points, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER calculate_task_points_trigger
BEFORE INSERT ON public.task_progress
FOR EACH ROW
EXECUTE FUNCTION public.calculate_task_points();

-- Update the student points function to include task points
CREATE OR REPLACE FUNCTION public.update_student_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET total_points = (
    SELECT COALESCE(SUM(points_earned), 0) 
    FROM public.lesson_progress 
    WHERE student_id = NEW.student_id
  ) + (
    SELECT COALESCE(SUM(points_earned), 0) 
    FROM public.homework_submissions 
    WHERE student_id = NEW.student_id
  ) + (
    SELECT COALESCE(SUM(points_earned), 0) 
    FROM public.task_progress 
    WHERE student_id = NEW.student_id
  )
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task progress points update
CREATE TRIGGER update_points_on_task_progress
AFTER INSERT ON public.task_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_student_points();
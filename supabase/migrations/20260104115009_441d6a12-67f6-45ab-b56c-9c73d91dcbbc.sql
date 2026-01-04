-- Create table for group lesson schedule (one row per lesson)
CREATE TABLE public.group_lesson_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  lesson_date DATE NOT NULL,
  lesson_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, lesson_number)
);

-- Enable RLS
ALTER TABLE public.group_lesson_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage lesson schedule"
ON public.group_lesson_schedule
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view schedule for assigned groups"
ON public.group_lesson_schedule
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_groups sg
  WHERE sg.id = group_lesson_schedule.group_id
  AND sg.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can update schedule for assigned groups"
ON public.group_lesson_schedule
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM student_groups sg
  WHERE sg.id = group_lesson_schedule.group_id
  AND sg.teacher_id = auth.uid()
));

-- Add index for performance
CREATE INDEX idx_group_lesson_schedule_group ON public.group_lesson_schedule(group_id);
CREATE INDEX idx_group_lesson_schedule_date ON public.group_lesson_schedule(lesson_date);

-- Trigger for updated_at
CREATE TRIGGER update_group_lesson_schedule_updated_at
BEFORE UPDATE ON public.group_lesson_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS policy for teachers to view author profiles in comments
CREATE POLICY "Teachers can view comment authors"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    role = 'teacher' OR role = 'admin'
  )
);
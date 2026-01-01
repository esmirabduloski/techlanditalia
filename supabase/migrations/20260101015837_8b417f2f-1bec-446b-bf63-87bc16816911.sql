-- Add due_date to homework table for deadlines
ALTER TABLE public.homework 
ADD COLUMN due_date timestamptz DEFAULT NULL;

-- Create table for student code drafts (saved code per lesson/task)
CREATE TABLE public.student_code_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.lesson_tasks(id) ON DELETE CASCADE,
  code_type text NOT NULL, -- 'python', 'html', 'css', 'js'
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Either lesson_id or task_id must be set, but not both
  CONSTRAINT code_draft_reference CHECK (
    (lesson_id IS NOT NULL AND task_id IS NULL) OR 
    (lesson_id IS NULL AND task_id IS NOT NULL)
  ),
  -- Unique constraint to ensure one draft per student per lesson/task per code type
  CONSTRAINT unique_student_lesson_code UNIQUE (student_id, lesson_id, code_type),
  CONSTRAINT unique_student_task_code UNIQUE (student_id, task_id, code_type)
);

-- Enable RLS
ALTER TABLE public.student_code_drafts ENABLE ROW LEVEL SECURITY;

-- Students can view their own drafts
CREATE POLICY "Students can view their code drafts"
ON public.student_code_drafts FOR SELECT
USING (auth.uid() = student_id);

-- Students can insert their own drafts
CREATE POLICY "Students can insert their code drafts"
ON public.student_code_drafts FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Students can update their own drafts
CREATE POLICY "Students can update their code drafts"
ON public.student_code_drafts FOR UPDATE
USING (auth.uid() = student_id);

-- Students can delete their own drafts
CREATE POLICY "Students can delete their code drafts"
ON public.student_code_drafts FOR DELETE
USING (auth.uid() = student_id);

-- Admins can manage all drafts
CREATE POLICY "Admins can manage all code drafts"
ON public.student_code_drafts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_student_code_drafts_updated_at
BEFORE UPDATE ON public.student_code_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
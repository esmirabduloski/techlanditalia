-- Create lesson_tasks table for sections within each lesson
CREATE TABLE public.lesson_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    task_number integer NOT NULL,
    title text NOT NULL,
    description text,
    content text,
    content_type text DEFAULT 'text',
    slides_url text,
    points_reward integer NOT NULL DEFAULT 10,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (lesson_id, task_number)
);

-- Enable RLS
ALTER TABLE public.lesson_tasks ENABLE ROW LEVEL SECURITY;

-- Anyone can view tasks
CREATE POLICY "Anyone can view tasks"
ON public.lesson_tasks
FOR SELECT
USING (true);

-- Admins can manage tasks
CREATE POLICY "Admins can manage tasks"
ON public.lesson_tasks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_lesson_tasks_lesson_id ON public.lesson_tasks(lesson_id);
CREATE INDEX idx_lesson_tasks_order ON public.lesson_tasks(lesson_id, task_number);
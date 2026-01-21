-- Add attachments column to lesson_tasks table for storing task attachments
ALTER TABLE public.lesson_tasks 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
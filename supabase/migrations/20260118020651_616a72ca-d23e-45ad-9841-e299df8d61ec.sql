-- Add replit_url column to lesson_tasks table
ALTER TABLE public.lesson_tasks ADD COLUMN IF NOT EXISTS replit_url TEXT;

-- Add replit_url column to homework table  
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS replit_url TEXT;
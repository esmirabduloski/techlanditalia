-- Add preview_only column to homework table
-- When true, the student view will show only the preview without the code editors
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS preview_only boolean NOT NULL DEFAULT false;
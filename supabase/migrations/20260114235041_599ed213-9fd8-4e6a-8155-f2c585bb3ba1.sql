-- Add scratch_url column to lesson_tasks table for Scratch game integration
ALTER TABLE public.lesson_tasks 
ADD COLUMN scratch_url TEXT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.lesson_tasks.scratch_url IS 'URL for embedded Scratch projects (e.g., https://scratch.mit.edu/projects/1266169747/embed)';
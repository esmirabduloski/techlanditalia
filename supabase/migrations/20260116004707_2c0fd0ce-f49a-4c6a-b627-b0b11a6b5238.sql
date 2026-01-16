-- Add python_env column to lesson_tasks to specify which Python environment to use
ALTER TABLE public.lesson_tasks
ADD COLUMN python_env TEXT DEFAULT 'standard';

-- Add comment explaining the column values
COMMENT ON COLUMN public.lesson_tasks.python_env IS 'Python environment type: standard (Pyodide), turtle (Trinket turtle), pgzero (Trinket pygame-zero)';
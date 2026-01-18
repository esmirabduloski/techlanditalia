-- Add python_env column to homework table
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS python_env TEXT DEFAULT 'standard';

-- Add comment for documentation
COMMENT ON COLUMN public.homework.python_env IS 'Python environment type: standard, turtle, or pgzero';
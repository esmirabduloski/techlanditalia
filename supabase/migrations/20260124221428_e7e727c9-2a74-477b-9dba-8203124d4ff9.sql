-- Add is_visible column to courses table
ALTER TABLE public.courses 
ADD COLUMN is_visible boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.courses.is_visible IS 'Controls whether the course is visible on the public /corsi page';
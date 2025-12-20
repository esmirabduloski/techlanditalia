-- Add teacher_feedback column for teacher comments to parents
ALTER TABLE public.homework_submissions 
ADD COLUMN IF NOT EXISTS teacher_feedback text,
ADD COLUMN IF NOT EXISTS feedback_at timestamp with time zone;

-- Add index for faster queries by parent
CREATE INDEX IF NOT EXISTS idx_homework_submissions_feedback 
ON public.homework_submissions(student_id, feedback_at) 
WHERE teacher_feedback IS NOT NULL;
ALTER TABLE public.homework_submissions
DROP CONSTRAINT IF EXISTS homework_submissions_status_check;

ALTER TABLE public.homework_submissions
ADD CONSTRAINT homework_submissions_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'approved'::text, 'graded'::text]));

-- Add status and archived_at columns to student_groups
ALTER TABLE public.student_groups 
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN archived_at timestamp with time zone;

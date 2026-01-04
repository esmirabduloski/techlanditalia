-- Add lesson_days column to student_groups for multiple weekly lesson days
-- Stores an array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
ALTER TABLE public.student_groups 
ADD COLUMN lesson_days integer[] DEFAULT ARRAY[0];

-- Create group_comments table for general group comments
CREATE TABLE public.group_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on group_comments
ALTER TABLE public.group_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_comments
CREATE POLICY "Admins can manage all group comments"
ON public.group_comments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view comments for their groups"
ON public.group_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM student_groups sg
    WHERE sg.id = group_comments.group_id
    AND sg.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can insert comments for their groups"
ON public.group_comments
FOR INSERT
WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (
    SELECT 1 FROM student_groups sg
    WHERE sg.id = group_comments.group_id
    AND sg.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can update their own group comments"
ON public.group_comments
FOR UPDATE
USING (auth.uid() = author_id);

CREATE POLICY "Teachers can delete their own group comments"
ON public.group_comments
FOR DELETE
USING (auth.uid() = author_id);

-- Add RLS policy for teachers to insert student comments
CREATE POLICY "Teachers can insert comments for their students"
ON public.student_comments
FOR INSERT
WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (
    SELECT 1 
    FROM group_students gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = student_comments.student_id 
    AND sg.teacher_id = auth.uid()
  )
);

-- Add RLS policy for teachers to update their own comments
CREATE POLICY "Teachers can update their own comments"
ON public.student_comments
FOR UPDATE
USING (auth.uid() = author_id);

-- Add RLS policy for teachers to delete their own comments
CREATE POLICY "Teachers can delete their own comments"
ON public.student_comments
FOR DELETE
USING (auth.uid() = author_id);
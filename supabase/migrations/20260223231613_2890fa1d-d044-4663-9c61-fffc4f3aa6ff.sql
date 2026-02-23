
-- Add certificates column to student_groups (JSONB array of file objects)
ALTER TABLE public.student_groups 
ADD COLUMN certificates jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for group certificates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('group-certificates', 'group-certificates', false);

-- Admins can manage certificate files
CREATE POLICY "Admins can manage certificate files"
ON storage.objects FOR ALL
USING (bucket_id = 'group-certificates' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Teachers can download certificate files for their groups
CREATE POLICY "Teachers can view certificate files"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-certificates' AND public.has_role(auth.uid(), 'teacher'::app_role));

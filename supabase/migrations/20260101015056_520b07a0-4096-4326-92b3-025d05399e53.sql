-- Add attachments column to homework table (array of file URLs)
ALTER TABLE public.homework 
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Add comment describing the structure
COMMENT ON COLUMN public.homework.attachments IS 'Array of attachment objects: [{name: string, url: string, size: number, type: string}]';

-- Create storage bucket for homework attachments (teacher uploads for students to download)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-attachments', 'homework-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view/download attachments (public bucket)
CREATE POLICY "Anyone can view homework attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework-attachments');

-- Only admins can upload attachments
CREATE POLICY "Admins can upload homework attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homework-attachments' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can update attachments
CREATE POLICY "Admins can update homework attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homework-attachments' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can delete attachments
CREATE POLICY "Admins can delete homework attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'homework-attachments' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
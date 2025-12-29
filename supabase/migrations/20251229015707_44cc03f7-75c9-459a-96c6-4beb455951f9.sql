-- Add columns to lessons table for rich content
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS slides_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Add columns to homework_submissions for file uploads
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create storage bucket for homework files
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-files', 'homework-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for web compiler assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-compiler-assets', 'web-compiler-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for homework-files bucket
CREATE POLICY "Students can upload their homework files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homework-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Students can view their homework files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Students can update their homework files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Students can delete their homework files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
);

-- RLS policies for web-compiler-assets bucket
CREATE POLICY "Authenticated users can upload web assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'web-compiler-assets' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view web assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'web-compiler-assets');

CREATE POLICY "Users can update their web assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their web assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
);
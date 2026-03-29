-- 1. Remove job_applications from Realtime (contains PII)
ALTER PUBLICATION supabase_realtime DROP TABLE public.job_applications;

-- 2. Fix web-compiler-assets INSERT policy: scope uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload web assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload web assets to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
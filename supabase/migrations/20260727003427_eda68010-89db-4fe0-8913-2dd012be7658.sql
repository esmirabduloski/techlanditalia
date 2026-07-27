
-- Restrict write policies on storage.objects to authenticated role only,
-- and re-enforce that the object path is scoped to auth.uid().

-- homework-attachments (admin-managed)
DROP POLICY IF EXISTS "Admins can upload homework attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update homework attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete homework attachments" ON storage.objects;

CREATE POLICY "Admins can upload homework attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'homework-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update homework attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'homework-attachments' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'homework-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete homework attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'homework-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

-- homework-files (students upload their own submissions)
DROP POLICY IF EXISTS "Students upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Students update own files" ON storage.objects;
DROP POLICY IF EXISTS "Students delete own files" ON storage.objects;

CREATE POLICY "Students upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'homework-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- web-compiler-assets (users' own workspace assets)
DROP POLICY IF EXISTS "Authenticated users can upload web assets to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own web assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own web assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload web assets to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own web assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'web-compiler-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own web assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

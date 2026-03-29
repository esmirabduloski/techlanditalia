-- Fix web-compiler-assets: restrict UPDATE/DELETE to file owner
DROP POLICY IF EXISTS "Users can delete their web assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their web assets" ON storage.objects;

CREATE POLICY "Users can delete their own web assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own web assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'web-compiler-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
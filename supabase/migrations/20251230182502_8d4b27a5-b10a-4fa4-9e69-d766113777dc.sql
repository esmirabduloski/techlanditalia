-- Make homework-files bucket private (student homework should not be public)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'homework-files';

-- Drop existing SELECT policy for homework-files if any
DROP POLICY IF EXISTS "Students can view their homework files" ON storage.objects;

-- Create proper SELECT policy for homework-files
-- Students can view their own files, parents can view children's files, admins can view all
CREATE POLICY "Authenticated users can view homework files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND (
    -- File owner can view
    auth.uid()::text = (storage.foldername(name))[1]
    -- Admins can view all
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Parents can view their children's files
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[1]
      AND parent_id = auth.uid()
    )
  )
);
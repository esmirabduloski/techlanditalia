-- Drop the bucket-specific policies we just created
DROP POLICY IF EXISTS "Admins and teachers can upload roblox material" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can update roblox material" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can delete roblox material" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can upload python material" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can update python material" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can delete python material" ON storage.objects;

-- Create universal policies for admins and teachers on ALL buckets
CREATE POLICY "Admins and teachers can upload to any bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins and teachers can update any bucket"
ON storage.objects
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins and teachers can delete from any bucket"
ON storage.objects
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'teacher')
);
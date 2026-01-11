-- Add upload policies for roblox-lesson-material bucket
CREATE POLICY "Admins and teachers can upload roblox material"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'roblox-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "Admins and teachers can update roblox material"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'roblox-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "Admins and teachers can delete roblox material"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'roblox-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);

-- Add upload policies for python-lesson-material bucket
CREATE POLICY "Admins and teachers can upload python material"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'python-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "Admins and teachers can update python material"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'python-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "Admins and teachers can delete python material"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'python-lesson-material' 
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'teacher')
  )
);
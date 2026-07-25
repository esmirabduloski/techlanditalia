
-- Scope homework-attachments and web-compiler-assets teacher writes to their own folder
DROP POLICY IF EXISTS "Teachers insert lesson material scoped" ON storage.objects;
DROP POLICY IF EXISTS "Teachers update lesson material scoped" ON storage.objects;
DROP POLICY IF EXISTS "Teachers delete lesson material scoped" ON storage.objects;

CREATE POLICY "Teachers insert lesson material scoped"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    ((bucket_id = 'roblox-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox'))
    OR ((bucket_id = 'python-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-base'))
    OR ((bucket_id = 'python-pro-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-avanzato'))
    OR ((bucket_id = 'ro2-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato'))
    OR (
      bucket_id IN ('homework-attachments','web-compiler-assets')
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

CREATE POLICY "Teachers update lesson material scoped"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    ((bucket_id = 'roblox-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox'))
    OR ((bucket_id = 'python-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-base'))
    OR ((bucket_id = 'python-pro-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-avanzato'))
    OR ((bucket_id = 'ro2-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato'))
    OR (
      bucket_id IN ('homework-attachments','web-compiler-assets')
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

CREATE POLICY "Teachers delete lesson material scoped"
ON storage.objects FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    ((bucket_id = 'roblox-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox'))
    OR ((bucket_id = 'python-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-base'))
    OR ((bucket_id = 'python-pro-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'python-avanzato'))
    OR ((bucket_id = 'ro2-lesson-material') AND is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato'))
    OR (
      bucket_id IN ('homework-attachments','web-compiler-assets')
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

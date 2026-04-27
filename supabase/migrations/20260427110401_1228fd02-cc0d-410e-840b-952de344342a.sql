-- 1. Tighten teacher access to homework-files: only their assigned students
DROP POLICY IF EXISTS "Teachers view student homework files" ON storage.objects;

CREATE POLICY "Teachers view assigned student homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- 2. Explicitly block direct client writes on newsletter_subscribers
-- (edge functions use service role and bypass RLS)
CREATE POLICY "Block client inserts on newsletter_subscribers"
ON public.newsletter_subscribers FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client updates on newsletter_subscribers"
ON public.newsletter_subscribers FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);


-- 1) Lock down job_applications: only service_role (edge function) can insert
DROP POLICY IF EXISTS "Anyone can insert job applications with validation" ON public.job_applications;

-- 2) Storage policies so students and parents can read their own group certificates
CREATE POLICY "Students can view their group certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-certificates'
  AND public.is_student_in_group(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Parents can view their children's group certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-certificates'
  AND public.is_parent_of_group(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

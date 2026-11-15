CREATE TABLE IF NOT EXISTS public.course_homework_tutorials (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  video_url text CHECK (video_url IS NULL OR (video_url ~* '^https://[^[:space:]]+$' AND length(video_url) <= 2048)),
  video_path text CHECK (video_path IS NULL OR (length(video_path) BETWEEN 1 AND 1024 AND split_part(video_path, '/', 1) = course_id::text)),
  pdf_path text CHECK (pdf_path IS NULL OR (length(pdf_path) BETWEEN 1 AND 1024 AND split_part(pdf_path, '/', 1) = course_id::text)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_homework_tutorials_one_video CHECK (video_url IS NULL OR video_path IS NULL)
);

DROP TRIGGER IF EXISTS update_course_homework_tutorials_updated_at ON public.course_homework_tutorials;
CREATE TRIGGER update_course_homework_tutorials_updated_at
  BEFORE UPDATE ON public.course_homework_tutorials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.course_homework_tutorials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_homework_tutorials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_homework_tutorials TO authenticated;
GRANT ALL ON public.course_homework_tutorials TO service_role;

DROP POLICY IF EXISTS "Enrolled students can view course homework tutorials" ON public.course_homework_tutorials;
CREATE POLICY "Enrolled students can view course homework tutorials"
ON public.course_homework_tutorials FOR SELECT TO authenticated
USING (public.is_enrolled_in_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "Admins can manage course homework tutorials" ON public.course_homework_tutorials;
CREATE POLICY "Admins can manage course homework tutorials"
ON public.course_homework_tutorials FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Course tutorials: enrolled students view" ON storage.objects;
CREATE POLICY "Course tutorials: enrolled students view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-tutorials'
  AND public.is_enrolled_in_course(auth.uid(), public.storage_folder_user(name))
);

SELECT public.ensure_mfa_policies();
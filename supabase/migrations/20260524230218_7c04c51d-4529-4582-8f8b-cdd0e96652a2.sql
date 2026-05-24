
-- Scope teacher access to lesson material buckets by course assignment
DROP POLICY IF EXISTS "Teachers manage lesson material buckets" ON storage.objects;
DROP POLICY IF EXISTS "Teachers update lesson material buckets" ON storage.objects;
DROP POLICY IF EXISTS "Teachers delete lesson material buckets" ON storage.objects;

-- Helper: check teacher assignment by course slug
CREATE OR REPLACE FUNCTION public.is_teacher_of_course_slug(_user_id uuid, _slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_courses tc
    JOIN public.courses c ON c.id = tc.course_id
    WHERE tc.teacher_id = _user_id
      AND c.slug = _slug
  )
$$;

-- Bucket -> course slug map used by the policies below
-- roblox-lesson-material      -> sviluppo-giochi-con-roblox
-- python-lesson-material      -> python-base
-- python-pro-lesson-material  -> python-avanzato
-- ro2-lesson-material         -> roblox-avanzato
-- homework-attachments and web-compiler-assets are shared across courses; any teacher may use them.

CREATE POLICY "Teachers insert lesson material scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    (bucket_id = 'roblox-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox')) OR
    (bucket_id = 'python-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'python-base')) OR
    (bucket_id = 'python-pro-lesson-material' AND public.is_teacher_of_course_slug(auth.uid(), 'python-avanzato')) OR
    (bucket_id = 'ro2-lesson-material'        AND public.is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato')) OR
    (bucket_id IN ('homework-attachments', 'web-compiler-assets'))
  )
);

CREATE POLICY "Teachers update lesson material scoped"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    (bucket_id = 'roblox-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox')) OR
    (bucket_id = 'python-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'python-base')) OR
    (bucket_id = 'python-pro-lesson-material' AND public.is_teacher_of_course_slug(auth.uid(), 'python-avanzato')) OR
    (bucket_id = 'ro2-lesson-material'        AND public.is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato')) OR
    (bucket_id IN ('homework-attachments', 'web-compiler-assets'))
  )
);

CREATE POLICY "Teachers delete lesson material scoped"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    (bucket_id = 'roblox-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'sviluppo-giochi-con-roblox')) OR
    (bucket_id = 'python-lesson-material'     AND public.is_teacher_of_course_slug(auth.uid(), 'python-base')) OR
    (bucket_id = 'python-pro-lesson-material' AND public.is_teacher_of_course_slug(auth.uid(), 'python-avanzato')) OR
    (bucket_id = 'ro2-lesson-material'        AND public.is_teacher_of_course_slug(auth.uid(), 'roblox-avanzato')) OR
    (bucket_id IN ('homework-attachments', 'web-compiler-assets'))
  )
);

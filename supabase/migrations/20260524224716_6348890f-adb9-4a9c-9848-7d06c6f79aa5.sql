
-- 1. Profiles: prevent self-update of role / parent_id at the RLS layer
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND parent_id IS NOT DISTINCT FROM (SELECT p.parent_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2. Lesson reports: teachers can only update reports for groups they still teach
DROP POLICY IF EXISTS "Teachers can update own reports" ON public.lesson_reports;
CREATE POLICY "Teachers can update own reports"
ON public.lesson_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = teacher_id AND public.is_teacher_of_group(auth.uid(), group_id))
WITH CHECK (auth.uid() = teacher_id AND public.is_teacher_of_group(auth.uid(), group_id));

-- 3. Student comments: teachers see only their own authored comments
DROP POLICY IF EXISTS "Teachers can view comments for their students" ON public.student_comments;
CREATE POLICY "Teachers can view their own authored comments"
ON public.student_comments
FOR SELECT
TO authenticated
USING (auth.uid() = author_id);

-- 4. Storage: teachers can only read certificates for their own groups
DROP POLICY IF EXISTS "Teachers can view certificate files" ON storage.objects;
CREATE POLICY "Teachers can view certificate files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-certificates'
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND public.is_teacher_of_group(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

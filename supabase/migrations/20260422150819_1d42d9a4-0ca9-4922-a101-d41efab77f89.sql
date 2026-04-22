
-- ============================================================
-- FIX 1: Storage over-permission for teachers
-- ============================================================
DROP POLICY IF EXISTS "Admins and teachers can upload to any bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can update any bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can delete from any bucket" ON storage.objects;

-- Admins keep full access to all buckets
CREATE POLICY "Admins manage all storage objects"
ON storage.objects FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can upload/update/delete only in lesson-material and asset buckets,
-- NOT in homework-files (student-owned) or group-certificates (admin-managed)
CREATE POLICY "Teachers manage lesson material buckets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  AND bucket_id IN (
    'roblox-lesson-material',
    'python-lesson-material',
    'python-pro-lesson-material',
    'ro2-lesson-material',
    'homework-attachments',
    'web-compiler-assets'
  )
);

CREATE POLICY "Teachers update lesson material buckets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND bucket_id IN (
    'roblox-lesson-material',
    'python-lesson-material',
    'python-pro-lesson-material',
    'ro2-lesson-material',
    'homework-attachments',
    'web-compiler-assets'
  )
);

CREATE POLICY "Teachers delete lesson material buckets"
ON storage.objects FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND bucket_id IN (
    'roblox-lesson-material',
    'python-lesson-material',
    'python-pro-lesson-material',
    'ro2-lesson-material',
    'homework-attachments',
    'web-compiler-assets'
  )
);

-- ============================================================
-- FIX 2: Public buckets allowing listing
-- Restrict SELECT to specific file lookups (still allows direct URL access
-- because public buckets serve files via CDN) but prevents listing all files.
-- We replace the broad "Anyone can view" policies with policies that don't
-- enable LIST (which uses SELECT on storage.objects).
-- For public buckets, files are still served via the public CDN URL even
-- without a SELECT policy, so removing the broad SELECT is safe.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view homework attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view web assets" ON storage.objects;

-- Only authenticated users can list (which is needed by some flows);
-- public CDN access continues to work because storage serves public buckets
-- via /object/public/<bucket>/<path> without requiring a SELECT policy match.
CREATE POLICY "Authenticated can view homework attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'homework-attachments');

CREATE POLICY "Owners can list own web assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'web-compiler-assets'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);

-- ============================================================
-- FIX 3: Profiles - tighten teacher access to other teachers/admins
-- The "Teachers can view comment authors" policy currently exposes ALL
-- teacher and admin profiles (including emails) to any teacher. Replace
-- it so teachers can only see basic info via a restricted view, but for
-- now drop the broad policy. The student_comments page already has
-- author_id available; teachers don't need to read all peer profiles.
-- ============================================================
DROP POLICY IF EXISTS "Teachers can view comment authors" ON public.profiles;

-- DDL from 0055_student_files_private.sql. Bucket creation is handled by the native Storage API.
-- Proprietario di un file dalla prima cartella del percorso ("<uuid>/foto.png");
-- NULL se la cartella non è un uuid, così le policy non falliscono sul cast.
CREATE OR REPLACE FUNCTION public.storage_folder_user(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND position('/' IN _name) > 0
    THEN split_part(_name, '/', 1)::uuid
  END
$$;

-- student-web-assets: lo studente gestisce la propria cartella, l'insegnante
-- dei suoi gruppi e il genitore possono solo vedere. L'admin ha già accesso a
-- tutti i bucket ("Admins manage all storage objects").
DROP POLICY IF EXISTS "Student web assets: upload to own folder" ON storage.objects;
CREATE POLICY "Student web assets: upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-web-assets'
  AND public.storage_folder_user(name) = auth.uid()
);

DROP POLICY IF EXISTS "Student web assets: view own files" ON storage.objects;
CREATE POLICY "Student web assets: view own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-web-assets'
  AND public.storage_folder_user(name) = auth.uid()
);

DROP POLICY IF EXISTS "Student web assets: delete own files" ON storage.objects;
CREATE POLICY "Student web assets: delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-web-assets'
  AND public.storage_folder_user(name) = auth.uid()
);

DROP POLICY IF EXISTS "Student web assets: teachers view their students" ON storage.objects;
CREATE POLICY "Student web assets: teachers view their students"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-web-assets'
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND public.is_teacher_of_student(auth.uid(), public.storage_folder_user(name))
);

DROP POLICY IF EXISTS "Student web assets: parents view their children" ON storage.objects;
CREATE POLICY "Student web assets: parents view their children"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-web-assets'
  AND public.is_parent_of(auth.uid(), public.storage_folder_user(name))
);

-- web-compiler-assets: niente più caricamenti o modifiche nelle cartelle
-- personali (i docenti continuano a usare task-attachments/ ed editor-uploads/).
DROP POLICY IF EXISTS "Authenticated users can upload web assets to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own web assets" ON storage.objects;
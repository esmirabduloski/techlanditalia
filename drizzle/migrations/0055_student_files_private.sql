-- Tutti i file degli studenti in spazi privati.
--
-- Stato dei bucket con file degli studenti:
--   homework-files       consegne dei compiti        privato (link firmati)
--   group-certificates   attestati con i nomi        privato (link firmati)
--   web-compiler-assets  immagini/CSS/JS caricati   PUBBLICO: chiunque avesse
--                        nel compilatore web         il link poteva aprirli
--
-- web-compiler-assets contiene anche i materiali dei docenti (task-attachments/,
-- editor-uploads/), già linkati con URL pubblici nelle lezioni: resta pubblico
-- per loro. I file degli studenti vanno invece nel nuovo bucket privato
-- student-web-assets, sempre nella cartella "<id utente>/", e l'app li apre
-- con link firmati. Quelli già caricati (web-compiler-assets/<id utente>/...)
-- li sposta l'admin da Admin → Privacy, riquadro "File degli studenti".
--
-- Gli altri bucket pubblici (homework-attachments e i *-lesson-material)
-- contengono solo materiali dei docenti: gli studenti non possono caricarci.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-web-assets', 'student-web-assets', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'text/css', 'application/javascript', 'text/javascript', 'text/html']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Rete di sicurezza: i bucket con file degli studenti restano privati
UPDATE storage.buckets SET public = false
WHERE id IN ('homework-files', 'group-certificates', 'student-web-assets') AND public;

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

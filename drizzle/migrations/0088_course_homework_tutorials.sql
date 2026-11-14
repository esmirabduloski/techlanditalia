-- Tutorial "come consegnare i compiti", uno per corso.
--
-- L'admin, da Admin → Corsi → Contenuto, carica per ogni corso un video
-- (link YouTube/Vimeo oppure file .mp4/.webm) e una guida in PDF. Nel tab
-- "Compiti" della pagina del corso lo studente iscritto vede il bottone
-- "Tutorial: come consegnare i compiti", che apre il video e, sotto, il PDF
-- pagina per pagina.
-- Senza riga (o senza video né PDF) niente bottone.
--
-- I file stanno nel bucket privato course-tutorials, nella cartella
-- "<id corso>/", e l'app li apre con link firmati.
--
-- Lo scrive solo l'admin (con 2FA, tramite ensure_mfa_policies); lo leggono
-- gli studenti iscritti al corso e l'admin.

CREATE TABLE IF NOT EXISTS public.course_homework_tutorials (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  -- Video: un link https (YouTube, Vimeo…) oppure un file nel bucket, non entrambi
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

-- Bucket privato: video e PDF, max 50 MB a file (il limite per file di Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-tutorials', 'course-tutorials', false, 52428800,
  ARRAY['video/mp4', 'video/webm', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Gli studenti iscritti leggono i file del proprio corso ("<id corso>/...").
-- storage_folder_user (0055) legge l'uuid della prima cartella. L'admin ha già
-- accesso a tutti i bucket ("Admins manage all storage objects").
DROP POLICY IF EXISTS "Course tutorials: enrolled students view" ON storage.objects;
CREATE POLICY "Course tutorials: enrolled students view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-tutorials'
  AND public.is_enrolled_in_course(auth.uid(), public.storage_folder_user(name))
);

SELECT public.ensure_mfa_policies();

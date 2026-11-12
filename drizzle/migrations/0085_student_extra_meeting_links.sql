-- Secondo link per entrare a lezione, per singolo studente.
--
-- Per i casi speciali (es. uno studente che segue anche la lezione di un altro
-- gruppo) l'admin, da Admin → Utenti, dà a uno studente un secondo link con il
-- testo del pulsante (es. "LINK PER GRUPPO DEL MARTEDÌ"). Lo studente e i suoi
-- genitori vedono un pulsante "Entra a lezione" in più, sempre, a prescindere
-- dal calendario. Senza riga niente pulsante: togliere il link cancella la riga.
--
-- Lo scrive solo l'admin (con 2FA, tramite mfa_required); lo leggono lo
-- studente, i suoi genitori e l'admin.

CREATE TABLE IF NOT EXISTS public.student_extra_meeting_links (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  url text NOT NULL CHECK (url ~* '^https://[^[:space:]]+$' AND length(url) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_student_extra_meeting_links_updated_at ON public.student_extra_meeting_links;
CREATE TRIGGER update_student_extra_meeting_links_updated_at
  BEFORE UPDATE ON public.student_extra_meeting_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_extra_meeting_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_extra_meeting_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_extra_meeting_links TO authenticated;
GRANT ALL ON public.student_extra_meeting_links TO service_role;

DROP POLICY IF EXISTS "Students can view their extra meeting link" ON public.student_extra_meeting_links;
CREATE POLICY "Students can view their extra meeting link"
ON public.student_extra_meeting_links FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Parents can view children extra meeting links" ON public.student_extra_meeting_links;
CREATE POLICY "Parents can view children extra meeting links"
ON public.student_extra_meeting_links FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Admins can manage extra meeting links" ON public.student_extra_meeting_links;
CREATE POLICY "Admins can manage extra meeting links"
ON public.student_extra_meeting_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

SELECT public.ensure_mfa_policies();
-- Figlia di profiles: entra nel cestino degli account eliminati
SELECT public.ensure_trash_triggers();

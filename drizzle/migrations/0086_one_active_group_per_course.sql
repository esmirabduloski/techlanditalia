-- Uno studente può stare in più gruppi: di corsi diversi senza limiti, dello
-- stesso corso in un solo gruppo ATTIVO. I gruppi archiviati non contano più:
-- chi ha finito Roblox-001 (archiviato) può entrare in Roblox-003.
--
-- Il controllo vale quando:
--   - si aggiunge uno studente a un gruppo attivo (trigger su group_students,
--     come prima ma solo tra gruppi attivi; aggiungerlo a un gruppo
--     archiviato non blocca);
--   - si riattiva un gruppo archiviato o si cambia il corso di un gruppo
--     attivo (trigger nuovo su student_groups): se uno dei suoi studenti è già
--     in un altro gruppo attivo di quel corso, il cambio viene rifiutato con il
--     nome dello studente e del gruppo.

CREATE OR REPLACE FUNCTION public.check_student_course_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_course_id uuid;
  new_status text;
  existing_group_title text;
BEGIN
  SELECT course_id, status INTO new_course_id, new_status
  FROM public.student_groups
  WHERE id = NEW.group_id;

  -- In un gruppo archiviato si può sempre aggiungere (storico)
  IF new_status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT sg.title INTO existing_group_title
  FROM public.group_students gs
  JOIN public.student_groups sg ON sg.id = gs.group_id
  WHERE gs.student_id = NEW.student_id
    AND sg.course_id = new_course_id
    AND sg.status = 'active'
    AND gs.group_id <> NEW.group_id
  LIMIT 1;

  IF existing_group_title IS NOT NULL THEN
    RAISE EXCEPTION 'Lo studente è già in un gruppo attivo per questo corso: %', existing_group_title;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_group_activation_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _student text;
  _other text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'active' AND OLD.course_id IS NOT DISTINCT FROM NEW.course_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.full_name, 'Uno studente'), sg.title INTO _student, _other
  FROM public.group_students mine
  JOIN public.group_students gs ON gs.student_id = mine.student_id AND gs.group_id <> NEW.id
  JOIN public.student_groups sg ON sg.id = gs.group_id
  LEFT JOIN public.profiles p ON p.id = mine.student_id
  WHERE mine.group_id = NEW.id
    AND sg.course_id = NEW.course_id
    AND sg.status = 'active'
  LIMIT 1;

  IF _other IS NOT NULL THEN
    RAISE EXCEPTION '% è già nel gruppo attivo "%" di questo corso', _student, _other;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_group_activation_uniqueness() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_group_activation_uniqueness_trigger ON public.student_groups;
CREATE TRIGGER check_group_activation_uniqueness_trigger
  BEFORE UPDATE OF status, course_id ON public.student_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.check_group_activation_uniqueness();

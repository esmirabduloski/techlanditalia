-- Collega automaticamente i lead CRM agli account con la stessa email.
-- Prima il collegamento (linked_profile_id) era stato fatto una sola volta, alla
-- creazione del CRM: gli account registrati dopo risultavano "senza account".

-- Nuovo account (o email cambiata): collega i lead con la stessa email ancora scollegati
CREATE OR REPLACE FUNCTION public.link_crm_leads_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.role IN ('parent', 'student') THEN
    UPDATE public.crm_leads
       SET linked_profile_id = NEW.id
     WHERE lower(email) = lower(NEW.email)
       AND linked_profile_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_crm_leads_on_profile ON public.profiles;
CREATE TRIGGER link_crm_leads_on_profile
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_crm_leads_to_profile();

-- Nuovo lead (o email cambiata): se esiste già un account con quella email, collegalo.
-- I genitori hanno la precedenza sugli studenti (sono loro che pagano).
CREATE OR REPLACE FUNCTION public.link_crm_lead_on_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.linked_profile_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT p.id INTO NEW.linked_profile_id
      FROM public.profiles p
     WHERE lower(p.email) = lower(NEW.email)
       AND p.role IN ('parent', 'student')
     ORDER BY (p.role = 'parent') DESC, p.created_at
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_crm_lead_on_write ON public.crm_leads;
CREATE TRIGGER link_crm_lead_on_write
  BEFORE INSERT OR UPDATE OF email ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.link_crm_lead_on_write();

-- Recupero dei lead già esistenti rimasti scollegati
UPDATE public.crm_leads cl
   SET linked_profile_id = (
     SELECT p.id FROM public.profiles p
      WHERE lower(p.email) = lower(cl.email)
        AND p.role IN ('parent', 'student')
      ORDER BY (p.role = 'parent') DESC, p.created_at
      LIMIT 1
   )
 WHERE cl.linked_profile_id IS NULL
   AND EXISTS (
     SELECT 1 FROM public.profiles p
      WHERE lower(p.email) = lower(cl.email) AND p.role IN ('parent', 'student')
   );

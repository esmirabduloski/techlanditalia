-- Colonne del profilo che l'utente NON può modificare da sé.
--
-- Dal 01/09 la policy "Users can update their own profile" consente di
-- aggiornare tutto il proprio profilo; i trigger proteggono solo role e
-- parent_id. Restavano modificabili dal client, per esempio:
--   lesson_balance  saldo lezioni prepagate (lezioni gratis)
--   total_points    punti della classifica
--   email           collega al proprio account il lead CRM con quell'email
--                   (e le sue rate) tramite link_crm_leads_to_profile
--   referral_code   codice referral (premi)
--   username        nome utente per il login degli studenti
-- Dal sito gli utenti cambiano solo avatar_id, bg_color e onboarding_completed.
--
-- Il controllo vale solo per le richieste dirette del client (ruolo
-- "authenticated"). Admin, service role (edge function) e funzioni SECURITY
-- DEFINER (punti assegnati in automatico, scalare il saldo alle presenze)
-- continuano a funzionare: per questo la funzione NON è SECURITY DEFINER,
-- così current_user è il ruolo che esegue davvero l'UPDATE.
CREATE OR REPLACE FUNCTION public.protect_profile_managed_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.lesson_balance IS DISTINCT FROM OLD.lesson_balance THEN
    RAISE EXCEPTION 'Il saldo lezioni può essere modificato solo dalla scuola';
  END IF;
  IF NEW.total_points IS DISTINCT FROM OLD.total_points THEN
    RAISE EXCEPTION 'I punti vengono assegnati automaticamente';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'L''email può essere modificata solo dalla scuola';
  END IF;
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Il codice referral non può essere modificato';
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Il nome utente può essere modificato solo dalla scuola';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_managed_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_managed_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_managed_columns();

-- Solo per il trigger: nessuno deve poterla chiamare dal client
REVOKE EXECUTE ON FUNCTION public.protect_profile_managed_columns() FROM anon, authenticated, public;

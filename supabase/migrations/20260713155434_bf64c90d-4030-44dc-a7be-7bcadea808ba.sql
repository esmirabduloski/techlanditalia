CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (edge functions using SUPABASE_SERVICE_ROLE_KEY) bypass this guard.
  IF auth.uid() IS NULL OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Non sei autorizzato a modificare il ruolo';
  END IF;
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'Non sei autorizzato a modificare il genitore';
  END IF;
  RETURN NEW;
END;
$function$;
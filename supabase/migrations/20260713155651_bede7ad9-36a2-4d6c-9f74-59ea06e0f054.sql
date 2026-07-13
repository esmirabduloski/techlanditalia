CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Backend/service-role operations and unauthenticated trigger contexts are allowed.
  IF auth.uid() IS NULL
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR COALESCE(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins are allowed to manage role and parent linkage from the admin area.
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Normal users cannot self-escalate role or change parent linkage.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Non sei autorizzato a modificare il ruolo';
  END IF;

  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'Non sei autorizzato a modificare il genitore';
  END IF;

  RETURN NEW;
END;
$$;

-- analytics_events: restrict user_id on insert
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (
  session_id IS NOT NULL
  AND event_type IS NOT NULL
  AND event_category IS NOT NULL
  AND event_action IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- conversion_funnels: restrict user_id on insert
DROP POLICY IF EXISTS "Anyone can insert conversion funnels" ON public.conversion_funnels;
CREATE POLICY "Anyone can insert conversion funnels"
ON public.conversion_funnels
FOR INSERT
WITH CHECK (
  session_id IS NOT NULL
  AND funnel_name IS NOT NULL
  AND step_name IS NOT NULL
  AND step_number IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- profiles: defense-in-depth trigger preventing role/parent_id self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_self_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_self_escalation();

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.crm_leads (email, full_name, phone, source, source_record_id, child_age, interest, original_message)
  VALUES (
    lower(NEW.email), NEW.parent_name, NEW.phone,
    'trial_booking'::crm_lead_source, NEW.id, NEW.child_age, NEW.interest, NEW.message
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), crm_leads.full_name),
    phone = COALESCE(EXCLUDED.phone, crm_leads.phone),
    child_age = COALESCE(EXCLUDED.child_age, crm_leads.child_age),
    interest = COALESCE(EXCLUDED.interest, crm_leads.interest),
    original_message = COALESCE(EXCLUDED.original_message, crm_leads.original_message),
    source_record_id = EXCLUDED.source_record_id,
    deleted_at = NULL,
    pipeline_stage = CASE WHEN crm_leads.deleted_at IS NOT NULL THEN 'new'::crm_pipeline_stage ELSE crm_leads.pipeline_stage END,
    updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.crm_leads (email, full_name, source, source_record_id, original_message)
  VALUES (
    lower(NEW.email), NEW.nome, 'contact_form'::crm_lead_source, NEW.id,
    NEW.oggetto || E'\n\n' || NEW.messaggio
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), crm_leads.full_name),
    original_message = COALESCE(EXCLUDED.original_message, crm_leads.original_message),
    deleted_at = NULL,
    pipeline_stage = CASE WHEN crm_leads.deleted_at IS NOT NULL THEN 'new'::crm_pipeline_stage ELSE crm_leads.pipeline_stage END,
    updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_newsletter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.crm_leads (email, source, source_record_id, pipeline_stage)
  VALUES (
    lower(NEW.email), 'newsletter'::crm_lead_source, NEW.id, 'nurture'::crm_pipeline_stage
  )
  ON CONFLICT (email) DO UPDATE SET
    deleted_at = NULL,
    updated_at = now()
  WHERE crm_leads.deleted_at IS NOT NULL;
  RETURN NEW;
END;
$function$;
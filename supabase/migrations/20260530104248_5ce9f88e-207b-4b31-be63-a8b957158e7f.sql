
-- 1. Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Add tracking columns to crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_error text;

CREATE INDEX IF NOT EXISTS idx_crm_leads_notion_page_id ON public.crm_leads(notion_page_id) WHERE notion_page_id IS NOT NULL;

-- 3. Settings table (singleton)
CREATE TABLE IF NOT EXISTS public.crm_notion_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  database_id text,
  property_mapping jsonb NOT NULL DEFAULT '{
    "title": "Nome",
    "email": "Email",
    "phone": "Telefono",
    "pipeline_stage": "Stage",
    "source": "Origine",
    "lead_score": "Score",
    "lifetime_value_cents": "LTV",
    "tags": "Tag",
    "next_followup_at": "Prossimo follow-up",
    "last_contacted_at": "Ultimo contatto",
    "child_age": "Eta alunno",
    "interest": "Interesse",
    "notes": "Note",
    "original_message": "Messaggio originale",
    "created_at": "Creato il"
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notion_settings TO authenticated;
GRANT ALL ON public.crm_notion_settings TO service_role;

ALTER TABLE public.crm_notion_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crm_notion_settings"
ON public.crm_notion_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed singleton row
INSERT INTO public.crm_notion_settings (singleton, enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

CREATE TRIGGER trg_crm_notion_settings_updated_at
BEFORE UPDATE ON public.crm_notion_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Sync log table
CREATE TABLE IF NOT EXISTS public.crm_notion_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  operation text NOT NULL,
  status text NOT NULL,
  notion_page_id text,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notion_sync_log_lead_id ON public.crm_notion_sync_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_notion_sync_log_created_at ON public.crm_notion_sync_log(created_at DESC);

GRANT SELECT ON public.crm_notion_sync_log TO authenticated;
GRANT ALL ON public.crm_notion_sync_log TO service_role;

ALTER TABLE public.crm_notion_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view crm_notion_sync_log"
ON public.crm_notion_sync_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Trigger function: async push to edge function
CREATE OR REPLACE FUNCTION public.trigger_notion_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_enabled boolean;
  has_db_id boolean;
  op text;
  target_lead_id uuid;
  target_page_id text;
  function_url text := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/sync-lead-to-notion';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40';
BEGIN
  -- Check if sync is enabled and configured
  SELECT enabled, (database_id IS NOT NULL AND database_id <> '')
  INTO is_enabled, has_db_id
  FROM public.crm_notion_settings
  WHERE singleton = true;

  IF NOT COALESCE(is_enabled, false) OR NOT COALESCE(has_db_id, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip if only sync-tracking columns changed (avoid infinite loop)
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.notion_page_id IS DISTINCT FROM OLD.notion_page_id
        OR NEW.notion_last_sync_at IS DISTINCT FROM OLD.notion_last_sync_at
        OR NEW.notion_sync_error IS DISTINCT FROM OLD.notion_sync_error)
       AND NEW.email = OLD.email
       AND NEW.full_name = OLD.full_name
       AND NEW.phone IS NOT DISTINCT FROM OLD.phone
       AND NEW.pipeline_stage = OLD.pipeline_stage
       AND NEW.source = OLD.source
       AND NEW.tags = OLD.tags
       AND NEW.lead_score = OLD.lead_score
       AND NEW.lifetime_value_cents = OLD.lifetime_value_cents
       AND NEW.next_followup_at IS NOT DISTINCT FROM OLD.next_followup_at
       AND NEW.last_contacted_at IS NOT DISTINCT FROM OLD.last_contacted_at
       AND NEW.notes IS NOT DISTINCT FROM OLD.notes
       AND NEW.child_age IS NOT DISTINCT FROM OLD.child_age
       AND NEW.interest IS NOT DISTINCT FROM OLD.interest
       AND NEW.original_message IS NOT DISTINCT FROM OLD.original_message THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    op := 'delete';
    target_lead_id := OLD.id;
    target_page_id := OLD.notion_page_id;
  ELSIF TG_OP = 'INSERT' THEN
    op := 'create';
    target_lead_id := NEW.id;
    target_page_id := NULL;
  ELSE
    op := 'update';
    target_lead_id := NEW.id;
    target_page_id := NEW.notion_page_id;
  END IF;

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'lead_id', target_lead_id,
      'operation', op,
      'notion_page_id', target_page_id
    ),
    timeout_milliseconds := 5000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Don't block CRM operations if Notion sync fails to enqueue
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_notion_sync ON public.crm_leads;
CREATE TRIGGER crm_leads_notion_sync
AFTER INSERT OR UPDATE OR DELETE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.trigger_notion_sync();

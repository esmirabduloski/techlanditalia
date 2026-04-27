
-- Pipeline stage enum
CREATE TYPE public.crm_pipeline_stage AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'nurture');

-- Interaction type enum
CREATE TYPE public.crm_interaction_type AS ENUM ('email', 'whatsapp', 'call', 'note', 'quote_sent', 'meeting', 'status_change', 'sms');

-- Lead source enum
CREATE TYPE public.crm_lead_source AS ENUM ('trial_booking', 'contact_form', 'newsletter', 'registered', 'manual', 'import');

-- =============== crm_leads ===============
CREATE TABLE public.crm_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  source crm_lead_source NOT NULL DEFAULT 'manual',
  pipeline_stage crm_pipeline_stage NOT NULL DEFAULT 'new',
  assigned_to uuid,
  tags text[] NOT NULL DEFAULT '{}',
  lead_score integer NOT NULL DEFAULT 0,
  lifetime_value_cents integer NOT NULL DEFAULT 0,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  notes text,
  linked_profile_id uuid,
  quote_genie_client_id text,
  source_record_id uuid,
  child_age integer,
  interest text,
  original_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_email_unique UNIQUE (email)
);

CREATE INDEX idx_crm_leads_stage ON public.crm_leads(pipeline_stage);
CREATE INDEX idx_crm_leads_assigned ON public.crm_leads(assigned_to);
CREATE INDEX idx_crm_leads_followup ON public.crm_leads(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_crm_leads_source ON public.crm_leads(source);
CREATE INDEX idx_crm_leads_email ON public.crm_leads(lower(email));

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all crm_leads"
ON public.crm_leads FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_crm_leads_updated_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== crm_interactions ===============
CREATE TABLE public.crm_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  admin_id uuid,
  type crm_interaction_type NOT NULL,
  subject text,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_interactions_lead ON public.crm_interactions(lead_id, created_at DESC);

ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all crm_interactions"
ON public.crm_interactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============== crm_tags ===============
CREATE TABLE public.crm_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#10b981',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crm_tags"
ON public.crm_tags FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.crm_tags (name, color) VALUES
  ('VIP', '#f59e0b'),
  ('Urgente', '#ef4444'),
  ('Genitore', '#3b82f6'),
  ('Da richiamare', '#8b5cf6'),
  ('Interessato Python', '#10b981'),
  ('Interessato Roblox', '#ec4899'),
  ('Interessato Scratch', '#06b6d4'),
  ('Prezzo alto', '#6b7280')
ON CONFLICT DO NOTHING;

-- =============== Sync function ===============
CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_leads (email, full_name, phone, source, source_record_id, child_age, interest, original_message)
  VALUES (
    lower(NEW.email),
    NEW.parent_name,
    NEW.phone,
    'trial_booking'::crm_lead_source,
    NEW.id,
    NEW.child_age,
    NEW.interest,
    NEW.message
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), crm_leads.full_name),
    phone = COALESCE(EXCLUDED.phone, crm_leads.phone),
    child_age = COALESCE(EXCLUDED.child_age, crm_leads.child_age),
    interest = COALESCE(EXCLUDED.interest, crm_leads.interest),
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_crm_from_trial_booking
AFTER INSERT ON public.trial_bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_from_trial();

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_leads (email, full_name, source, source_record_id, original_message)
  VALUES (
    lower(NEW.email),
    NEW.nome,
    'contact_form'::crm_lead_source,
    NEW.id,
    NEW.oggetto || E'\n\n' || NEW.messaggio
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), crm_leads.full_name),
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_crm_from_contact_submission
AFTER INSERT ON public.contact_submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_from_contact();

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_newsletter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_leads (email, source, source_record_id, pipeline_stage)
  VALUES (
    lower(NEW.email),
    'newsletter'::crm_lead_source,
    NEW.id,
    'nurture'::crm_pipeline_stage
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_crm_from_newsletter
AFTER INSERT ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_from_newsletter();

-- Auto log status change
CREATE OR REPLACE FUNCTION public.log_crm_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    INSERT INTO public.crm_interactions (lead_id, admin_id, type, subject, content, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      'status_change'::crm_interaction_type,
      'Stato pipeline cambiato',
      OLD.pipeline_stage::text || ' → ' || NEW.pipeline_stage::text,
      jsonb_build_object('from', OLD.pipeline_stage, 'to', NEW.pipeline_stage)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_crm_stage_change_trigger
AFTER UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.log_crm_stage_change();

-- =============== BACKFILL ===============
-- 1. Trial bookings
INSERT INTO public.crm_leads (email, full_name, phone, source, source_record_id, child_age, interest, original_message, created_at)
SELECT lower(email), parent_name, phone, 'trial_booking'::crm_lead_source, id, child_age, interest, message, created_at
FROM public.trial_bookings
ON CONFLICT (email) DO NOTHING;

-- 2. Contact submissions
INSERT INTO public.crm_leads (email, full_name, source, source_record_id, original_message, created_at)
SELECT lower(email), nome, 'contact_form'::crm_lead_source, id, oggetto || E'\n\n' || messaggio, created_at
FROM public.contact_submissions
ON CONFLICT (email) DO NOTHING;

-- 3. Newsletter subscribers (only confirmed)
INSERT INTO public.crm_leads (email, source, source_record_id, pipeline_stage, created_at)
SELECT lower(email), 'newsletter'::crm_lead_source, id, 'nurture'::crm_pipeline_stage, created_at
FROM public.newsletter_subscribers
WHERE confirmed = true
ON CONFLICT (email) DO NOTHING;

-- 4. Registered profiles (parents only - they pay)
INSERT INTO public.crm_leads (email, full_name, source, linked_profile_id, pipeline_stage, created_at)
SELECT lower(p.email), p.full_name, 'registered'::crm_lead_source, p.id, 'won'::crm_pipeline_stage, p.created_at
FROM public.profiles p
WHERE p.role = 'parent' AND p.email IS NOT NULL
ON CONFLICT (email) DO UPDATE SET
  linked_profile_id = EXCLUDED.linked_profile_id,
  pipeline_stage = 'won'::crm_pipeline_stage;

-- Link existing leads to profiles by email
UPDATE public.crm_leads cl
SET linked_profile_id = p.id
FROM public.profiles p
WHERE lower(p.email) = cl.email AND cl.linked_profile_id IS NULL;

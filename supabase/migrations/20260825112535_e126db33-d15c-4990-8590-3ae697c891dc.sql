ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_crm_leads_deleted_at ON public.crm_leads (deleted_at);
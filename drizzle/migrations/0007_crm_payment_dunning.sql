-- Solleciti automatici delle rate scadute e non pagate
ALTER TABLE public.crm_payments
  ADD COLUMN IF NOT EXISTS overdue_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_overdue_reminder_at timestamptz;

-- Regole dei solleciti (modificabili dallo Scadenziario del CRM), solo admin
INSERT INTO public.site_settings (key, value, is_public)
VALUES (
  'crm_payment_dunning',
  '{"enabled": true, "first_after_days": 3, "repeat_every_days": 7, "max_reminders": 3, "notify_client": false}'::jsonb,
  false
)
ON CONFLICT (key) DO NOTHING;
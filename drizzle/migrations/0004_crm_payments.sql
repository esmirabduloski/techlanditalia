-- Pagamenti dei clienti CRM: pagamenti ricevuti e rate pianificate, con promemoria push
CREATE TABLE IF NOT EXISTS public.crm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  -- scheduled = rata da incassare, paid = incassato, cancelled = annullata
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'cancelled')),
  description text,
  -- Data prevista (rate pianificate) e data di ricezione del pagamento
  due_date date,
  paid_at date,
  method text,
  -- Rate generate insieme dallo schedulatore
  plan_id uuid,
  installment_number integer,
  installment_total integer,
  -- Promemoria push: all'admin ("chiedi il pagamento") e/o al cliente ("rata in scadenza")
  reminder_date date,
  remind_admin boolean NOT NULL DEFAULT true,
  remind_client boolean NOT NULL DEFAULT false,
  admin_reminder_sent_at timestamptz,
  client_reminder_sent_at timestamptz,
  -- sent | no_account | no_devices | failed
  client_reminder_result text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_payments_paid_has_date CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_payments_lead ON public.crm_payments (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_payments_reminders ON public.crm_payments (reminder_date) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_crm_payments_paid_at ON public.crm_payments (paid_at) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_crm_payments_due_date ON public.crm_payments (due_date) WHERE status = 'scheduled';

ALTER TABLE public.crm_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_payments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_payments TO authenticated;
GRANT ALL ON public.crm_payments TO service_role;

DROP POLICY IF EXISTS "Admins manage crm_payments" ON public.crm_payments;
CREATE POLICY "Admins manage crm_payments" ON public.crm_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_crm_payments_updated_at ON public.crm_payments;
CREATE TRIGGER update_crm_payments_updated_at
  BEFORE UPDATE ON public.crm_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Il valore cliente (lifetime_value_cents, sincronizzato anche su Notion) = somma dei pagamenti incassati
CREATE OR REPLACE FUNCTION public.sync_crm_lead_lifetime_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead uuid := COALESCE(NEW.lead_id, OLD.lead_id);
BEGIN
  UPDATE public.crm_leads
     SET lifetime_value_cents = COALESCE((
       SELECT SUM(amount_cents) FROM public.crm_payments
        WHERE lead_id = v_lead AND status = 'paid'
     ), 0)
   WHERE id = v_lead;
  IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
    UPDATE public.crm_leads
       SET lifetime_value_cents = COALESCE((
         SELECT SUM(amount_cents) FROM public.crm_payments
          WHERE lead_id = OLD.lead_id AND status = 'paid'
       ), 0)
     WHERE id = OLD.lead_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS crm_payments_sync_lifetime_value ON public.crm_payments;
CREATE TRIGGER crm_payments_sync_lifetime_value
  AFTER INSERT OR UPDATE OF amount_cents, status, lead_id OR DELETE ON public.crm_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_lifetime_value();

-- Token per il job giornaliero dei promemoria (stesso meccanismo di send-lesson-reminders)
INSERT INTO public.internal_cron_tokens(name) VALUES ('send-payment-reminders') ON CONFLICT DO NOTHING;

-- Ogni mattina alle 07:00 UTC (08:00/09:00 ora italiana) invia i promemoria del giorno
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-payment-reminders-daily';
    PERFORM cron.schedule(
      'send-payment-reminders-daily',
      '0 7 * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/send-payment-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'send-payment-reminders')
        ),
        body := '{"trigger":"scheduled"}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END
$cron$;

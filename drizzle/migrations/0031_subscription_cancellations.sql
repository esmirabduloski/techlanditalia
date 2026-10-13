-- Questionario di disdetta.
--
-- Quando una famiglia disdice, l'admin registra la disdetta dalla scheda del
-- lead nel CRM rispondendo a tre domande (le chiede alla famiglia al telefono
-- o su WhatsApp). Senza il motivo non si sa cosa correggere: le risposte sono
-- riassunte in CRM → Analytics.
--   1. motivo principale (reason, + reason_other se "altro");
--   2. cosa vi avrebbe fatto restare? (would_have_stayed, testo libero);
--   3. tornereste in futuro? (would_return: sì / forse / no).
-- Dati interni del CRM: solo admin.

CREATE TABLE IF NOT EXISTS public.subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  -- Studente che lascia; null = tutta la famiglia
  student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'cost', 'schedule', 'lost_interest', 'little_progress', 'too_busy', 'moving', 'teacher_group', 'other'
  )),
  reason_other text,
  would_have_stayed text,
  would_return text NOT NULL CHECK (would_return IN ('yes', 'maybe', 'no')),
  cancelled_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Rome')::date),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_lead ON public.subscription_cancellations(lead_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_student ON public.subscription_cancellations(student_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_date ON public.subscription_cancellations(cancelled_on DESC);

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all subscription_cancellations" ON public.subscription_cancellations;
CREATE POLICY "Admins manage all subscription_cancellations"
ON public.subscription_cancellations FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

SELECT public.ensure_mfa_policies();

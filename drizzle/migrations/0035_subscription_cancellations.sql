CREATE TABLE IF NOT EXISTS public.subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cancellations TO authenticated;
GRANT ALL ON public.subscription_cancellations TO service_role;

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
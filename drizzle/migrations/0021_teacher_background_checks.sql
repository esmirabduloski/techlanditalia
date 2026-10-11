-- Promemoria certificato del casellario giudiziale per gli insegnanti
-- (art. 25-bis DPR 313/2002, introdotto dal D.Lgs. 39/2014).
--
-- Si salvano SOLO le date della verifica: il certificato e il suo contenuto
-- (dati giudiziari, art. 10 GDPR) restano fuori dall'app, nel fascicolo del
-- personale.
CREATE TABLE IF NOT EXISTS public.teacher_background_checks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at date NOT NULL,
  next_check_at date NOT NULL,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT background_check_dates CHECK (next_check_at > verified_at)
);

ALTER TABLE public.teacher_background_checks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_background_checks TO authenticated;
GRANT ALL ON public.teacher_background_checks TO service_role;

DROP POLICY IF EXISTS "Admins manage teacher background checks" ON public.teacher_background_checks;
CREATE POLICY "Admins manage teacher background checks"
ON public.teacher_background_checks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Nuova tabella: anche qui serve la 2FA (vedi 0020_mfa_two_factor_enable)
SELECT public.ensure_mfa_policies();

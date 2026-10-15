-- Password dello studente separata da quella del genitore.
--
-- Prima: il figlio nasceva con la password del genitore e il login studente
-- (edge function student-login), se la password dello studente era sbagliata,
-- provava quella del genitore e la copiava sul figlio. Così il figlio poteva
-- sempre entrare con la password del genitore.
--
-- Ora il genitore imposta la password del figlio dall'area riservata
-- (edge function parent-set-child-password). Il vecchio meccanismo resta solo
-- per gli studenti "legacy" e solo fino alla data in
-- STUDENT_PARENT_PASSWORD_FALLBACK_UNTIL (vedi _shared/studentpassword.ts):
--   - nessuna riga qui            → studente legacy, fallback ammesso;
--   - own_password = false        → legacy, il fallback è stato usato
--                                   (parent_fallback_used_at = ultimo uso);
--   - own_password = true         → password propria, niente fallback.
-- Le righe le scrivono solo le edge function (service role).

CREATE TABLE IF NOT EXISTS public.student_password_settings (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  own_password boolean NOT NULL DEFAULT true,
  -- Chi ha impostato la password: il genitore, un admin, o NULL alla creazione
  set_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  set_at timestamptz,
  parent_fallback_used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_password_settings_fallback
  ON public.student_password_settings(parent_fallback_used_at DESC)
  WHERE own_password = false;

ALTER TABLE public.student_password_settings ENABLE ROW LEVEL SECURITY;

-- Gli admin vedono chi usa ancora la password del genitore prima dello stop
DROP POLICY IF EXISTS "Admins view student_password_settings" ON public.student_password_settings;
CREATE POLICY "Admins view student_password_settings"
ON public.student_password_settings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

SELECT public.ensure_mfa_policies();

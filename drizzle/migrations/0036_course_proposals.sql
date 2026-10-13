-- Proposta del corso successivo a fine corso.
--
-- Verso la fine di un gruppo l'insegnante propone, per ogni alunno, il corso
-- successivo con il motivo scritto da lui ("ha preso bene i cicli, è pronto
-- per Python"). La proposta parte come bozza: l'admin la rivede nella scheda
-- del lead nel CRM, sceglie lo sconto per chi continua subito (50 € di
-- default, diverso famiglia per famiglia) e la scadenza dell'offerta, poi la
-- invia. La famiglia la riceve per email e push e la trova in evidenza
-- nell'area riservata, dove risponde "Sì, continuiamo" o "Ne parliamo".
--
-- Stati: draft (scritta dall'insegnante, da inviare) → sent → accepted |
-- declined; withdrawn = ritirata dall'admin. Invio e risposta passano dalla
-- edge function course-proposal (service role): i genitori qui hanno solo la
-- lettura, e mai delle bozze.

CREATE TABLE IF NOT EXISTS public.course_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Gruppo che sta finendo: decide quale insegnante vede la proposta
  group_id uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  proposed_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  teacher_reason text NOT NULL CHECK (length(btrim(teacher_reason)) >= 10),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'withdrawn')),
  -- Sconto per chi conferma entro offer_expires_on; 0 = nessuno sconto
  discount_cents integer NOT NULL DEFAULT 5000 CHECK (discount_cents >= 0 AND discount_cents <= 100000),
  offer_expires_on date,
  sent_at timestamptz,
  sent_by uuid,
  email_sent_at timestamptz,
  responded_at timestamptz,
  responded_by uuid,
  -- Lo sconto vale solo se la famiglia ha confermato entro la scadenza
  discount_applies boolean,
  parent_note text CHECK (parent_note IS NULL OR length(parent_note) <= 1000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR status = 'withdrawn' OR offer_expires_on IS NOT NULL)
);

-- Una sola proposta aperta (bozza o inviata) per alunno e gruppo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_course_proposals_open
  ON public.course_proposals(student_id, group_id) WHERE status IN ('draft', 'sent');
CREATE INDEX IF NOT EXISTS idx_course_proposals_student ON public.course_proposals(student_id);
CREATE INDEX IF NOT EXISTS idx_course_proposals_group ON public.course_proposals(group_id);
CREATE INDEX IF NOT EXISTS idx_course_proposals_status ON public.course_proposals(status);

DROP TRIGGER IF EXISTS update_course_proposals_updated_at ON public.course_proposals;
CREATE TRIGGER update_course_proposals_updated_at
  BEFORE UPDATE ON public.course_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.course_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all course_proposals" ON public.course_proposals;
CREATE POLICY "Admins manage all course_proposals"
ON public.course_proposals FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- L'insegnante vede le proposte dei propri gruppi, scrive e corregge le bozze
-- per gli alunni del gruppo. Sconto, scadenza e invio restano all'admin.
DROP POLICY IF EXISTS "Teachers view their groups course_proposals" ON public.course_proposals;
CREATE POLICY "Teachers view their groups course_proposals"
ON public.course_proposals FOR SELECT
TO authenticated
USING (public.is_teacher_of_group(auth.uid(), group_id));

DROP POLICY IF EXISTS "Teachers create draft course_proposals" ON public.course_proposals;
CREATE POLICY "Teachers create draft course_proposals"
ON public.course_proposals FOR INSERT
TO authenticated
WITH CHECK (
  status = 'draft'
  AND created_by = auth.uid()
  AND public.is_teacher_of_group(auth.uid(), group_id)
  AND public.is_student_in_group(student_id, group_id)
);

DROP POLICY IF EXISTS "Teachers edit draft course_proposals" ON public.course_proposals;
CREATE POLICY "Teachers edit draft course_proposals"
ON public.course_proposals FOR UPDATE
TO authenticated
USING (status = 'draft' AND public.is_teacher_of_group(auth.uid(), group_id))
WITH CHECK (
  status = 'draft'
  AND public.is_teacher_of_group(auth.uid(), group_id)
  AND public.is_student_in_group(student_id, group_id)
);

DROP POLICY IF EXISTS "Teachers delete draft course_proposals" ON public.course_proposals;
CREATE POLICY "Teachers delete draft course_proposals"
ON public.course_proposals FOR DELETE
TO authenticated
USING (status = 'draft' AND public.is_teacher_of_group(auth.uid(), group_id));

-- L'insegnante non decide lo sconto: sulle bozze resta quello di default
CREATE OR REPLACE FUNCTION public.course_proposals_guard_teacher()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.discount_cents := 5000;
      NEW.offer_expires_on := NULL;
    ELSE
      NEW.discount_cents := OLD.discount_cents;
      NEW.offer_expires_on := OLD.offer_expires_on;
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_proposals_guard_teacher ON public.course_proposals;
CREATE TRIGGER course_proposals_guard_teacher
  BEFORE INSERT OR UPDATE ON public.course_proposals
  FOR EACH ROW EXECUTE FUNCTION public.course_proposals_guard_teacher();

-- Famiglia: solo le proposte inviate (non le bozze)
DROP POLICY IF EXISTS "Parents view children course_proposals" ON public.course_proposals;
CREATE POLICY "Parents view children course_proposals"
ON public.course_proposals FOR SELECT
TO authenticated
USING (status <> 'draft' AND status <> 'withdrawn' AND public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Students view own course_proposals" ON public.course_proposals;
CREATE POLICY "Students view own course_proposals"
ON public.course_proposals FOR SELECT
TO authenticated
USING (status <> 'draft' AND status <> 'withdrawn' AND auth.uid() = student_id);

SELECT public.ensure_mfa_policies();

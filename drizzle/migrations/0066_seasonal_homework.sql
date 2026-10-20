-- Compiti stagionali (Halloween, Natale, Carnevale, Estate…).
--
-- L'admin li gestisce in Admin → Compiti stagionali: per ogni tema c'è al più
-- un compito per corso, che parte dalla richiesta standard del tema e si
-- personalizza per il corso. Un compito stagionale è una riga di homework con
-- seasonal_theme_id e course_id:
--   - lesson_id NULL: in archivio, non compare in nessuna lezione e gli alunni
--     non lo possono consegnare (is_enrolled_for_homework passa dalla lezione);
--   - lesson_id valorizzato: è un compito per casa di quella lezione del corso.
-- Inserire, spostare e togliere cambiano solo lesson_id, così consegne e
-- correzioni restano. Se si cancella la lezione il compito torna in archivio.
--
-- I compiti in archivio restano leggibili a chi è nel corso (alunni, genitori,
-- insegnanti): le consegne già fatte continuano a mostrare il loro compito e
-- l'insegnante le può ancora correggere.

-- ── Temi ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seasonal_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  emoji text NOT NULL DEFAULT '✨',
  -- Richiesta standard, uguale per tutti i corsi
  prompt text NOT NULL DEFAULT '',
  -- Quando proporlo, es. "fine ottobre"
  period_hint text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_themes_name_key UNIQUE (name)
);

DROP TRIGGER IF EXISTS update_seasonal_themes_updated_at ON public.seasonal_themes;
CREATE TRIGGER update_seasonal_themes_updated_at
  BEFORE UPDATE ON public.seasonal_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Li leggono tutti gli utenti autenticati, li scrive solo l'admin (con 2FA, tramite mfa_required)
ALTER TABLE public.seasonal_themes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasonal_themes TO authenticated;
GRANT ALL ON public.seasonal_themes TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view seasonal themes" ON public.seasonal_themes;
CREATE POLICY "Authenticated users can view seasonal themes"
ON public.seasonal_themes FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage seasonal themes" ON public.seasonal_themes;
CREATE POLICY "Admins can manage seasonal themes"
ON public.seasonal_themes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.seasonal_themes (name, emoji, prompt, period_hint, sort_order) VALUES
  ('Halloween', '🎃', 'Crea una mappa, degli oggetti o un gioco a tema Halloween: zucche, fantasmi, pipistrelli, case stregate…', 'fine ottobre', 1),
  ('Natale', '🎄', 'Crea una mappa, degli oggetti o un gioco a tema Natale: alberi decorati, regali, neve, la slitta di Babbo Natale…', 'dicembre', 2),
  ('Carnevale', '🎭', 'Crea una mappa, degli oggetti o un gioco a tema Carnevale: maschere, coriandoli, carri e costumi…', 'febbraio', 3),
  ('Estate', '☀️', 'Crea una mappa, degli oggetti o un gioco a tema Estate: spiaggia, mare, gelati, vacanze…', 'giugno', 4)
ON CONFLICT (name) DO NOTHING;

-- ── Tema e corso sui compiti ───────────────────────────────────────────────
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS seasonal_theme_id uuid REFERENCES public.seasonal_themes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- Un compito stagionale in archivio non ha lezione
ALTER TABLE public.homework ALTER COLUMN lesson_id DROP NOT NULL;

-- Compito normale: sempre in una lezione, senza tema né corso (il corso è quello della lezione).
-- Compito stagionale: tema e corso sempre, lezione facoltativa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homework_seasonal_shape' AND conrelid = 'public.homework'::regclass
  ) THEN
    ALTER TABLE public.homework ADD CONSTRAINT homework_seasonal_shape CHECK (
      (seasonal_theme_id IS NULL AND course_id IS NULL AND lesson_id IS NOT NULL)
      OR (seasonal_theme_id IS NOT NULL AND course_id IS NOT NULL)
    );
  END IF;
END $$;

-- Un solo compito per tema e corso
CREATE UNIQUE INDEX IF NOT EXISTS homework_seasonal_theme_course_key
  ON public.homework(seasonal_theme_id, course_id)
  WHERE seasonal_theme_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_homework_course_id
  ON public.homework(course_id)
  WHERE course_id IS NOT NULL;

-- Il compito stagionale si inserisce solo in una lezione del suo corso
CREATE OR REPLACE FUNCTION public.seasonal_homework_check_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.seasonal_theme_id IS NOT NULL AND NEW.lesson_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM lessons WHERE id = NEW.lesson_id AND course_id = NEW.course_id) THEN
    RAISE EXCEPTION 'Il compito stagionale si può inserire solo in una lezione del suo corso'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seasonal_homework_check_lesson ON public.homework;
CREATE TRIGGER seasonal_homework_check_lesson
  BEFORE INSERT OR UPDATE OF lesson_id, course_id, seasonal_theme_id ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.seasonal_homework_check_lesson();

-- Lezione cancellata: i compiti stagionali tornano in archivio invece di
-- sparire con la cascata (insieme alle loro consegne); quelli normali no.
-- Se si cancella tutto il corso i suoi compiti se ne vanno con lui.
CREATE OR REPLACE FUNCTION public.seasonal_homework_unlink_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM courses WHERE id = OLD.course_id) THEN
    UPDATE homework SET lesson_id = NULL
    WHERE lesson_id = OLD.id AND seasonal_theme_id IS NOT NULL;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS seasonal_homework_unlink_lesson ON public.lessons;
CREATE TRIGGER seasonal_homework_unlink_lesson
  BEFORE DELETE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.seasonal_homework_unlink_lesson();

-- ── Chi vede i compiti ─────────────────────────────────────────────────────
-- Come prima, più i compiti stagionali in archivio per chi è nel corso.
-- Niente subquery su homework_submissions: le sue policy leggono homework (ricorsione).
DROP POLICY IF EXISTS "Authorized users can view homework" ON public.homework;
CREATE POLICY "Authorized users can view homework" ON public.homework
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = homework.lesson_id
      AND (
        is_enrolled_in_course(auth.uid(), l.course_id)
        OR is_parent_of_enrolled(auth.uid(), l.course_id)
        OR is_teacher_of_course(auth.uid(), l.course_id)
      )
  )
  OR (
    homework.lesson_id IS NULL
    AND homework.course_id IS NOT NULL
    AND (
      is_enrolled_in_course(auth.uid(), homework.course_id)
      OR is_parent_of_enrolled(auth.uid(), homework.course_id)
      OR is_teacher_of_course(auth.uid(), homework.course_id)
    )
  )
);

-- ── Consegne: l'insegnante le vede e corregge anche a compito tolto ────────
-- Il corso è quello della lezione o, per un compito in archivio, quello del compito.
DROP POLICY IF EXISTS "Teachers can view submissions for their students" ON public.homework_submissions;
CREATE POLICY "Teachers can view submissions for their students"
ON public.homework_submissions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework h
  LEFT JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, COALESCE(l.course_id, h.course_id))
));

DROP POLICY IF EXISTS "Teachers can grade submissions for their students" ON public.homework_submissions;
CREATE POLICY "Teachers can grade submissions for their students"
ON public.homework_submissions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework h
  LEFT JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, COALESCE(l.course_id, h.course_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.homework h
  LEFT JOIN public.lessons l ON l.id = h.lesson_id
  WHERE h.id = homework_submissions.homework_id
    AND public.is_teacher_of_student_in_course(auth.uid(), homework_submissions.student_id, COALESCE(l.course_id, h.course_id))
));

SELECT public.ensure_mfa_policies();

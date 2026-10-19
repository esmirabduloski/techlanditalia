-- Mappa delle competenze, allineata al quadro europeo DigComp 2.2.
--
-- L'admin collega ogni lezione ai concetti che insegna (variabili, cicli,
-- condizioni…) in lessons.concepts. Il catalogo dei concetti e la loro
-- corrispondenza con DigComp stanno nel codice (src/lib/skillMap.ts): qui
-- niente CHECK sugli id, così un concetto nuovo non richiede una migrazione.
--
-- Il livello di ogni concetto si calcola dalle lezioni fatte (completate o con
-- presenza) e dai voti dei compiti di quelle lezioni. L'insegnante può
-- confermarlo o cambiarlo in student_skill_assessments: il suo livello vince.
--
-- student_skill_evidence restituisce solo conteggi e medie, uguali per chi la
-- chiama (studente, genitore, insegnante dello studente, admin).

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS concepts text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.student_skill_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept text NOT NULL CHECK (concept ~ '^[a-z_]{1,40}$'),
  -- 0 da scoprire, 1 base, 2 intermedio, 3 avanzato
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 3),
  note text CHECK (note IS NULL OR length(note) <= 500),
  assessed_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_skill_assessments_student_concept_key UNIQUE (student_id, concept)
);

DROP TRIGGER IF EXISTS update_student_skill_assessments_updated_at ON public.student_skill_assessments;
CREATE TRIGGER update_student_skill_assessments_updated_at
  BEFORE UPDATE ON public.student_skill_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_skill_assessments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_skill_assessments TO authenticated;
GRANT ALL ON public.student_skill_assessments TO service_role;

DROP POLICY IF EXISTS "Admins can manage skill assessments" ON public.student_skill_assessments;
CREATE POLICY "Admins can manage skill assessments"
ON public.student_skill_assessments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Teachers can view skill assessments of their students" ON public.student_skill_assessments;
CREATE POLICY "Teachers can view skill assessments of their students"
ON public.student_skill_assessments FOR SELECT TO authenticated
USING (public.is_teacher_of_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Teachers can insert skill assessments for their students" ON public.student_skill_assessments;
CREATE POLICY "Teachers can insert skill assessments for their students"
ON public.student_skill_assessments FOR INSERT TO authenticated
WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id) AND assessed_by = auth.uid());

DROP POLICY IF EXISTS "Teachers can update skill assessments of their students" ON public.student_skill_assessments;
CREATE POLICY "Teachers can update skill assessments of their students"
ON public.student_skill_assessments FOR UPDATE TO authenticated
USING (public.is_teacher_of_student(auth.uid(), student_id))
WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id) AND assessed_by = auth.uid());

DROP POLICY IF EXISTS "Teachers can delete skill assessments of their students" ON public.student_skill_assessments;
CREATE POLICY "Teachers can delete skill assessments of their students"
ON public.student_skill_assessments FOR DELETE TO authenticated
USING (public.is_teacher_of_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Parents can view children skill assessments" ON public.student_skill_assessments;
CREATE POLICY "Parents can view children skill assessments"
ON public.student_skill_assessments FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Students can view their skill assessments" ON public.student_skill_assessments;
CREATE POLICY "Students can view their skill assessments"
ON public.student_skill_assessments FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- Una riga per concetto presente nelle lezioni dei corsi dello studente (gruppi
-- o iscrizioni) o in una valutazione dell'insegnante. Una lezione è "incontrata"
-- se completata sulla piattaforma o con presenza in classe; per i compiti conta
-- l'ultima consegna con un voto (dell'insegnante, altrimenti automatico).
CREATE OR REPLACE FUNCTION public.student_skill_evidence(p_student_id uuid)
RETURNS TABLE(
  concept text,
  lessons_tagged integer,
  lessons_met integer,
  lessons_completed integer,
  homework_scored integer,
  homework_avg numeric,
  last_activity timestamptz,
  course_ids uuid[],
  teacher_level smallint,
  teacher_note text,
  assessed_at timestamptz,
  assessed_by_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_uid = p_student_id
          OR public.is_parent_of(v_uid, p_student_id)
          OR public.is_teacher_of_student(v_uid, p_student_id)
          OR public.has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH student_courses AS (
    SELECT sg.course_id
    FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE gs.student_id = p_student_id
    UNION
    SELECT e.course_id FROM public.enrollments e WHERE e.student_id = p_student_id
  ),
  tagged AS (
    SELECT DISTINCT l.id AS lesson_id, l.course_id, l.lesson_number, t.concept
    FROM public.lessons l
    JOIN student_courses sc ON sc.course_id = l.course_id
    CROSS JOIN LATERAL unnest(l.concepts) AS t(concept)
  ),
  completed AS (
    SELECT lp.lesson_id, min(lp.completed_at) AS completed_at
    FROM public.lesson_progress lp
    WHERE lp.student_id = p_student_id
    GROUP BY lp.lesson_id
  ),
  attended AS (
    SELECT sg.course_id, ga.lesson_number, max(ga.marked_at) AS marked_at
    FROM public.group_attendance ga
    JOIN public.student_groups sg ON sg.id = ga.group_id
    WHERE ga.student_id = p_student_id AND ga.status = 'present'
    GROUP BY sg.course_id, ga.lesson_number
  ),
  scores AS (
    SELECT DISTINCT ON (hs.homework_id)
      h.lesson_id,
      coalesce(hs.grade, hs.auto_score)::numeric AS score,
      coalesce(hs.feedback_at, hs.submitted_at) AS scored_at
    FROM public.homework_submissions hs
    JOIN public.homework h ON h.id = hs.homework_id
    WHERE hs.student_id = p_student_id AND coalesce(hs.grade, hs.auto_score) IS NOT NULL
    ORDER BY hs.homework_id, hs.submitted_at DESC
  ),
  evidence AS (
    SELECT t.concept,
      count(*)::integer AS lessons_tagged,
      count(*) FILTER (WHERE c.completed_at IS NOT NULL OR a.marked_at IS NOT NULL)::integer AS lessons_met,
      count(*) FILTER (WHERE c.completed_at IS NOT NULL)::integer AS lessons_completed,
      greatest(max(c.completed_at), max(a.marked_at)) AS last_lesson_at,
      array_agg(DISTINCT t.course_id) AS course_ids
    FROM tagged t
    LEFT JOIN completed c ON c.lesson_id = t.lesson_id
    LEFT JOIN attended a ON a.course_id = t.course_id AND a.lesson_number = t.lesson_number
    GROUP BY t.concept
  ),
  hw AS (
    SELECT t.concept,
      count(*)::integer AS homework_scored,
      round(avg(s.score), 1) AS homework_avg,
      max(s.scored_at) AS last_hw_at
    FROM tagged t
    JOIN scores s ON s.lesson_id = t.lesson_id
    GROUP BY t.concept
  ),
  asmt AS (
    SELECT a.concept, a.level, a.note, a.updated_at, p.full_name
    FROM public.student_skill_assessments a
    LEFT JOIN public.profiles p ON p.id = a.assessed_by
    WHERE a.student_id = p_student_id
  )
  SELECT
    coalesce(e.concept, s.concept),
    coalesce(e.lessons_tagged, 0),
    coalesce(e.lessons_met, 0),
    coalesce(e.lessons_completed, 0),
    coalesce(h.homework_scored, 0),
    h.homework_avg,
    greatest(e.last_lesson_at, h.last_hw_at),
    coalesce(e.course_ids, '{}'::uuid[]),
    s.level,
    s.note,
    s.updated_at,
    s.full_name
  FROM evidence e
  LEFT JOIN hw h ON h.concept = e.concept
  FULL JOIN asmt s ON s.concept = e.concept
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.student_skill_evidence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_skill_evidence(uuid) TO authenticated, service_role;

SELECT public.ensure_mfa_policies();

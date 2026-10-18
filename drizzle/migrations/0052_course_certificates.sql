CREATE TABLE IF NOT EXISTS public.course_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  course_title text NOT NULL,
  course_emoji text,
  teacher_name text NOT NULL,
  lessons_attended int NOT NULL CHECK (lessons_attended >= 0),
  lessons_total int NOT NULL CHECK (lessons_total > 0),
  hours_attended numeric(5, 1) NOT NULL CHECK (hours_attended >= 0),
  hard_skills text[] NOT NULL DEFAULT '{}',
  soft_skills text[] NOT NULL DEFAULT '{}',
  issued_on date NOT NULL,
  code text NOT NULL UNIQUE,
  released_by uuid,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_course_certificates_student ON public.course_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_course_certificates_group ON public.course_certificates(group_id);

ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all course_certificates" ON public.course_certificates;
CREATE POLICY "Admins manage all course_certificates"
ON public.course_certificates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Teachers view their groups course_certificates" ON public.course_certificates;
CREATE POLICY "Teachers view their groups course_certificates"
ON public.course_certificates FOR SELECT
TO authenticated
USING (public.is_teacher_of_group(auth.uid(), group_id));

DROP POLICY IF EXISTS "Parents view children course_certificates" ON public.course_certificates;
CREATE POLICY "Parents view children course_certificates"
ON public.course_certificates FOR SELECT
TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Students view own course_certificates" ON public.course_certificates;
CREATE POLICY "Students view own course_certificates"
ON public.course_certificates FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_certificates TO authenticated;
GRANT ALL ON public.course_certificates TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_mfa_policies()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND (n.nspname = 'public' OR (n.nspname = 'storage' AND c.relname = 'objects'))
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname
          AND p.tablename = c.relname
          AND (p.policyname = 'mfa_required' OR p.policyname LIKE 'mfa\_required\_%'))
  LOOP
    EXECUTE format(
      'CREATE POLICY mfa_required ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))',
      t.schema_name, t.table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_mfa_policies() FROM PUBLIC, anon, authenticated;

SELECT public.ensure_mfa_policies();

CREATE OR REPLACE FUNCTION public.new_certificate_code(_year int)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT 'TL-' || _year || '-' || string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), ''
  )
  FROM generate_series(1, 5);
$$;
REVOKE ALL ON FUNCTION public.new_certificate_code(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_group_certificates(p_group_id uuid)
RETURNS SETOF public.course_certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  g record;
  v_last_date date;
  v_teacher text;
  v_hard text[];
  v_soft text[];
  s record;
  v_row public.course_certificates;
  v_attended int;
BEGIN
  IF v_uid IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_teacher_of_group(v_uid, p_group_id) OR public.has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Solo l''insegnante del gruppo può sbloccare gli attestati' USING ERRCODE = '42501';
  END IF;

  SELECT sg.id, sg.max_lessons, sg.teacher_id, c.title, c.emoji, c.detail_content
  INTO g
  FROM student_groups sg JOIN courses c ON c.id = sg.course_id
  WHERE sg.id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gruppo non trovato' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(g.max_lessons, 0) <= 0 THEN
    RAISE EXCEPTION 'Il gruppo non ha un numero di lezioni impostato' USING ERRCODE = '22023';
  END IF;

  SELECT lesson_date INTO v_last_date
  FROM group_lesson_schedule
  WHERE group_id = p_group_id AND lesson_number = g.max_lessons;
  IF v_last_date IS NOT NULL THEN
    IF v_today < v_last_date THEN
      RAISE EXCEPTION 'Gli attestati si sbloccano il giorno della lezione % (%)',
        g.max_lessons, to_char(v_last_date, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM group_attendance WHERE group_id = p_group_id AND lesson_number >= g.max_lessons
  ) THEN
    RAISE EXCEPTION 'Gli attestati si sbloccano alla lezione %: segna prima le presenze', g.max_lessons
      USING ERRCODE = '22023';
  END IF;

  SELECT nullif(btrim(full_name), '') INTO v_teacher FROM profiles WHERE id = g.teacher_id;

  SELECT coalesce(array_agg(btrim(x)) FILTER (WHERE btrim(x) <> ''), '{}') INTO v_hard
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(g.detail_content->'certificate'->'hardSkills') = 'array'
         THEN g.detail_content->'certificate'->'hardSkills' ELSE '[]'::jsonb END
  ) AS x;
  SELECT coalesce(array_agg(btrim(x)) FILTER (WHERE btrim(x) <> ''), '{}') INTO v_soft
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(g.detail_content->'certificate'->'softSkills') = 'array'
         THEN g.detail_content->'certificate'->'softSkills' ELSE '[]'::jsonb END
  ) AS x;
  IF cardinality(v_hard) = 0 THEN
    v_hard := ARRAY['Fondamenti di programmazione', 'Logica e algoritmi', 'Creazione di progetti digitali',
                    'Lettura e correzione degli errori'];
  END IF;
  IF cardinality(v_soft) = 0 THEN
    v_soft := ARRAY['Problem solving', 'Creatività', 'Pensiero logico', 'Perseveranza'];
  END IF;

  FOR s IN
    SELECT gs.student_id, p.full_name
    FROM group_students gs JOIN profiles p ON p.id = gs.student_id
    WHERE gs.group_id = p_group_id
      AND NOT EXISTS (SELECT 1 FROM course_certificates cc WHERE cc.student_id = gs.student_id AND cc.group_id = p_group_id)
    ORDER BY p.full_name
  LOOP
    SELECT count(DISTINCT lesson_number)::int INTO v_attended
    FROM group_attendance
    WHERE group_id = p_group_id AND student_id = s.student_id AND status = 'present'
      AND lesson_number BETWEEN 1 AND g.max_lessons;

    FOR attempt IN 1..5 LOOP
      BEGIN
        INSERT INTO course_certificates (
          student_id, group_id, student_name, course_title, course_emoji, teacher_name,
          lessons_attended, lessons_total, hours_attended, hard_skills, soft_skills,
          issued_on, code, released_by
        ) VALUES (
          s.student_id, p_group_id, btrim(s.full_name), g.title, g.emoji, coalesce(v_teacher, 'Lo staff TECHLAND'),
          v_attended, g.max_lessons, v_attended * 1.5, v_hard[1:5], v_soft[1:4],
          v_today, public.new_certificate_code(extract(year FROM v_today)::int), v_uid
        )
        RETURNING * INTO v_row;
        RETURN NEXT v_row;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt = 5 THEN RAISE; END IF;
      END;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.release_group_certificates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_group_certificates(uuid) TO authenticated, service_role;

WITH presets(ord, pattern, hard, soft) AS (
  VALUES
    (1, '%roblox%avanzat%',
      ARRAY['Script Lua avanzati e moduli', 'Meccaniche di gioco complesse', 'Interfacce utente e dati di gioco',
            'Modellazione 3D ed effetti', 'Debug e ottimizzazione del codice'],
      ARRAY['Lavoro in team', 'Pensiero progettuale', 'Problem solving', 'Autonomia']),
    (2, '%roblox%',
      ARRAY['Programmazione in Lua', 'Modellazione 3D in Roblox Studio', 'Logica di gioco ed eventi',
            'Progettazione di livelli', 'Pubblicazione di un gioco online'],
      ARRAY['Problem solving', 'Creatività', 'Pensiero progettuale', 'Perseveranza']),
    (3, '%python%ai%',
      ARRAY['Python per l''intelligenza artificiale', 'Chatbot e modelli linguistici', 'Analisi e gestione dei dati',
            'Sviluppo di app e siti web', 'Pubblicazione di progetti online'],
      ARRAY['Pensiero critico', 'Creatività', 'Problem solving', 'Uso responsabile dell''AI']),
    (4, '%python%avanzat%',
      ARRAY['Programmazione a oggetti in Python', 'Strutture dati e file', 'Librerie esterne e API',
            'App con interfaccia grafica', 'Debug e test del codice'],
      ARRAY['Pensiero analitico', 'Problem solving', 'Autonomia', 'Organizzazione del lavoro']),
    (5, '%python%',
      ARRAY['Sintassi e basi di Python', 'Variabili, condizioni e cicli', 'Funzioni e liste',
            'Giochi con la grafica in Python', 'Lettura e correzione degli errori'],
      ARRAY['Pensiero logico', 'Problem solving', 'Precisione', 'Perseveranza']),
    (6, '%scratch%',
      ARRAY['Programmazione a blocchi con Scratch', 'Cicli, condizioni e variabili', 'Eventi e messaggi tra personaggi',
            'Animazione di sprite e scenari', 'Progettazione di giochi interattivi'],
      ARRAY['Problem solving', 'Creatività', 'Pensiero logico', 'Perseveranza']),
    (7, '%minecraft%',
      ARRAY['Programmazione a blocchi in Minecraft', 'Cicli, condizioni e funzioni', 'Automazione con l''Agente',
            'Costruzione e progettazione 3D', 'Algoritmi per risolvere sfide'],
      ARRAY['Problem solving', 'Pensiero spaziale', 'Creatività', 'Collaborazione']),
    (8, '%web%',
      ARRAY['Struttura delle pagine con HTML', 'Stile e layout con CSS', 'Interattività con JavaScript',
            'Siti responsive per smartphone', 'Pubblicazione di un sito web'],
      ARRAY['Creatività', 'Attenzione ai dettagli', 'Problem solving', 'Pensiero progettuale']),
    (9, '%design%',
      ARRAY['Grafica digitale e composizione', 'Uso di colori e forme', 'Disegno e illustrazione digitale',
            'Basi di animazione', 'Progettazione di personaggi'],
      ARRAY['Creatività', 'Espressione personale', 'Pazienza', 'Senso estetico']),
    (10, '%informatica%',
      ARRAY['Uso consapevole del computer', 'Gestione di file e cartelle', 'Navigazione web sicura',
            'Scrittura e presentazioni digitali', 'Primi passi nel coding'],
      ARRAY['Autonomia digitale', 'Sicurezza online', 'Organizzazione', 'Curiosità'])
),
matched AS (
  SELECT DISTINCT ON (c.id) c.id, p.hard, p.soft
  FROM public.courses c
  JOIN presets p ON c.slug ILIKE p.pattern OR c.title ILIKE p.pattern
  WHERE NOT (coalesce(c.detail_content, '{}'::jsonb) ? 'certificate')
  ORDER BY c.id, p.ord
)
UPDATE public.courses c
SET detail_content = coalesce(c.detail_content, '{}'::jsonb)
  || jsonb_build_object('certificate', jsonb_build_object('hardSkills', to_jsonb(m.hard), 'softSkills', to_jsonb(m.soft)))
FROM matched m
WHERE m.id = c.id;
-- Secondo genitore: un alunno può avere più genitori che entrano nell'area riservata.
--
-- profiles.parent_id resta il genitore principale (il referente: email
-- automatiche, consensi legali, eliminazione dell'account insieme ai figli).
-- student_guardians aggiunge gli altri genitori: per le regole di accesso sono
-- genitori a tutti gli effetti, perché is_parent_of() e le altre funzioni
-- is_parent_of_* guardano anche questa tabella.
--
-- Il collegamento lo fa l'admin da Utenti → "Assegna figli"
-- (admin_set_parent_children): un alunno senza genitore diventa figlio
-- principale, uno che ne ha già uno riceve il genitore in più.
--
-- Nel CRM il secondo genitore sta nella stessa scheda del lead del primo
-- (colonne second_parent_*).
--
-- Dipende da 0076_account_trash (ridefinisce trash_account).

-- ── Genitori in più ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_guardians (
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, guardian_id),
  CONSTRAINT student_guardians_not_self CHECK (student_id <> guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian ON public.student_guardians (guardian_id);

ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_guardians FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_guardians TO authenticated;
GRANT ALL ON public.student_guardians TO service_role;

-- ── Chi è genitore di chi ──────────────────────────────────────────────────
-- Stesse firme, attributi e permessi di prima: cambia solo che contano anche
-- i genitori in più.
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _student_id AND parent_id = _parent_id
  ) OR EXISTS (
    SELECT 1 FROM public.student_guardians
    WHERE student_id = _student_id AND guardian_id = _parent_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_children_ids(_parent_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE parent_id = _parent_id
  UNION
  SELECT student_id FROM public.student_guardians WHERE guardian_id = _parent_id
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_enrolled(_parent_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = _course_id AND e.status = 'active'
      AND e.student_id IN (SELECT public.get_children_ids(_parent_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_group(_parent_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_students gs
    WHERE gs.group_id = _group_id
      AND gs.student_id IN (SELECT public.get_children_ids(_parent_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_teacher(_parent_id uuid, _teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_students gs
    JOIN public.student_groups sg ON sg.id = gs.group_id
    WHERE sg.teacher_id = _teacher_id
      AND gs.student_id IN (SELECT public.get_children_ids(_parent_id))
  )
$$;

-- ── Regole che controllavano parent_id direttamente ───────────────────────
-- Le altre passano già da is_parent_of*(). Funzioni SECURITY DEFINER anche qui:
-- una subquery su student_guardians da una policy di profiles (e viceversa)
-- darebbe "infinite recursion detected in policy".
DROP POLICY IF EXISTS "Parents can view children profiles" ON public.profiles;
CREATE POLICY "Parents can view children profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_parent_of(auth.uid(), id));

DROP POLICY IF EXISTS "Family reads student guardians" ON public.student_guardians;
CREATE POLICY "Family reads student guardians"
  ON public.student_guardians FOR SELECT TO authenticated
  USING (guardian_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "Admins manage student guardians" ON public.student_guardians;
CREATE POLICY "Admins manage student guardians"
  ON public.student_guardians FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Policy create in produzione senza una migrazione su main (rami lovable-sync
-- di luglio): si aggiornano solo se ci sono, con la stessa parte per gli alunni.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_courses'
               AND policyname = 'Students can view their teachers courses') THEN
    DROP POLICY "Students can view their teachers courses" ON public.teacher_courses;
    CREATE POLICY "Students can view their teachers courses"
      ON public.teacher_courses FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.group_students gs
          JOIN public.student_groups sg ON sg.id = gs.group_id
          WHERE gs.student_id = auth.uid() AND sg.teacher_id = teacher_courses.teacher_id
        )
        OR public.is_parent_of_teacher(auth.uid(), teacher_courses.teacher_id)
      );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_profiles'
               AND policyname = 'Parents can view teacher profiles of children groups') THEN
    DROP POLICY "Parents can view teacher profiles of children groups" ON public.teacher_profiles;
    CREATE POLICY "Parents can view teacher profiles of children groups"
      ON public.teacher_profiles FOR SELECT TO authenticated
      USING (public.is_parent_of_teacher(auth.uid(), teacher_profiles.user_id));
  END IF;
END $$;

-- ── Assegna figli (Admin → Utenti) ────────────────────────────────────────
-- _children è l'elenco completo dei figli del genitore dopo il salvataggio:
--   - un alunno senza genitore diventa suo figlio (genitore principale);
--   - un alunno che ha già un altro genitore principale lo riceve come genitore in più;
--   - un figlio tolto: se il genitore era il principale e c'è un altro
--     genitore, diventa lui il principale; altrimenti l'alunno resta senza.
-- Errori: 42501 non admin, P0002 genitore non trovato, 22023 alunni non validi.
CREATE OR REPLACE FUNCTION public.admin_set_parent_children(_parent uuid, _children uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _kids uuid[] := coalesce(_children, '{}'::uuid[]);
  _kid uuid;
  _heir uuid;
BEGIN
  -- has_role() vuole anche la verifica in due passaggi per l'utente corrente
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo gli admin possono assegnare i figli' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _parent AND role = 'parent') THEN
    RAISE EXCEPTION 'Genitore non trovato' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_kids) k
    LEFT JOIN public.profiles p ON p.id = k
    WHERE p.id IS NULL OR p.role IS DISTINCT FROM 'student'
  ) THEN
    RAISE EXCEPTION 'Uno o più alunni non sono assegnabili' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.student_guardians
  WHERE guardian_id = _parent AND NOT (student_id = ANY (_kids));

  FOR _kid, _heir IN
    SELECT p.id,
           (SELECT g.guardian_id FROM public.student_guardians g
            WHERE g.student_id = p.id ORDER BY g.created_at, g.guardian_id LIMIT 1)
    FROM public.profiles p
    WHERE p.parent_id = _parent AND NOT (p.id = ANY (_kids))
  LOOP
    UPDATE public.profiles SET parent_id = _heir WHERE id = _kid;
    DELETE FROM public.student_guardians WHERE student_id = _kid AND guardian_id = _heir;
  END LOOP;

  UPDATE public.profiles SET parent_id = _parent
  WHERE id = ANY (_kids) AND parent_id IS NULL;

  INSERT INTO public.student_guardians (student_id, guardian_id)
  SELECT p.id, _parent FROM public.profiles p
  WHERE p.id = ANY (_kids) AND p.parent_id IS DISTINCT FROM _parent
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_parent_children(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_parent_children(uuid, uuid[]) TO authenticated;

-- ── Eliminazione dell'account (come 0076) ─────────────────────────────────
-- Un figlio che ha anche un altro genitore non va nel cestino col genitore
-- principale: resta all'altro, che diventa principale. Chi si elimina passa a
-- genitore in più di quel figlio, così la riga finisce nel batch con il suo
-- profilo e il ripristino lo ricollega.
CREATE OR REPLACE FUNCTION public.trash_account(_user uuid, _by uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _batch uuid := gen_random_uuid();
  _users uuid[];
  _kid uuid;
  _heir uuid;
BEGIN
  WITH RECURSIVE family(id) AS (
    SELECT p.id FROM public.profiles p WHERE p.id = _user
    UNION
    SELECT p.id FROM public.profiles p JOIN family f ON p.parent_id = f.id
    WHERE NOT EXISTS (SELECT 1 FROM public.student_guardians g
                      WHERE g.student_id = p.id AND g.guardian_id <> f.id)
  )
  SELECT array_agg(id) INTO _users FROM family;
  IF _users IS NULL THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR _kid, _heir IN
    SELECT p.id,
           (SELECT g.guardian_id FROM public.student_guardians g
             WHERE g.student_id = p.id AND g.guardian_id <> _user
            ORDER BY g.created_at, g.guardian_id LIMIT 1)
    FROM public.profiles p
    WHERE p.parent_id = _user
  LOOP
    CONTINUE WHEN _heir IS NULL;
    DELETE FROM public.student_guardians WHERE student_id = _kid AND guardian_id = _user;
    UPDATE public.student_guardians SET guardian_id = _user WHERE student_id = _kid AND guardian_id = _heir;
    UPDATE public.profiles SET parent_id = _heir WHERE id = _kid;
  END LOOP;

  PERFORM set_config('techland.trash_batch', coalesce(auth.uid()::text, '') || '/' || _batch::text, true);
  PERFORM set_config('techland.account_trash', 'on', true);

  INSERT INTO public.account_trash (user_id, batch_id, previous_banned_until, deleted_by)
  SELECT u.id, _batch, u.banned_until, _by
  FROM auth.users u
  WHERE u.id = ANY (_users);

  -- GoTrue rifiuta login e rinnovo della sessione finché banned_until è nel futuro
  UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = ANY (_users);

  -- Prima riga del batch = il profilo dell'account (la "radice" in trash_batches)
  DELETE FROM public.profiles WHERE id = _user;

  UPDATE public.trash_items SET deleted_by = _by WHERE batch_id = _batch;

  PERFORM set_config('techland.account_trash', '', true);
  PERFORM set_config('techland.trash_batch', '', true);
  RETURN _batch;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trash_account(uuid, uuid) TO service_role;

-- ── CRM: il secondo genitore nella stessa scheda ──────────────────────────
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS second_parent_name text,
  ADD COLUMN IF NOT EXISTS second_parent_email text,
  ADD COLUMN IF NOT EXISTS second_parent_phone text;

SELECT public.ensure_mfa_policies();
SELECT public.ensure_trash_triggers();

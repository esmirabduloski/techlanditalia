
-- 1. Tabella streak_freezes
CREATE TABLE public.streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  freeze_type text NOT NULL CHECK (freeze_type IN ('homework','attendance')),
  used_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  related_homework_id uuid,
  related_lesson_number integer,
  auto_consumed boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_streak_freezes_student_month ON public.streak_freezes (student_id, used_at);

GRANT SELECT ON public.streak_freezes TO authenticated;
GRANT ALL ON public.streak_freezes TO service_role;

ALTER TABLE public.streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own freezes"
  ON public.streak_freezes FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Parents view children freezes"
  ON public.streak_freezes FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE POLICY "Admins manage freezes"
  ON public.streak_freezes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Funzione che consuma un freeze (max 2/mese per tipo)
CREATE OR REPLACE FUNCTION public.consume_streak_freeze(
  _student_id uuid,
  _freeze_type text,
  _reason text DEFAULT NULL,
  _auto boolean DEFAULT false,
  _homework_id uuid DEFAULT NULL,
  _lesson_number integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_count integer;
BEGIN
  IF _freeze_type NOT IN ('homework','attendance') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO used_count
  FROM public.streak_freezes
  WHERE student_id = _student_id
    AND freeze_type = _freeze_type
    AND used_at >= date_trunc('month', now())
    AND used_at < date_trunc('month', now()) + interval '1 month';

  IF used_count >= 2 THEN
    RETURN false;
  END IF;

  INSERT INTO public.streak_freezes (student_id, freeze_type, reason, auto_consumed, related_homework_id, related_lesson_number)
  VALUES (_student_id, _freeze_type, _reason, _auto, _homework_id, _lesson_number);

  RETURN true;
END;
$$;

-- Permetti agli alunni di consumare i propri freeze manualmente
REVOKE ALL ON FUNCTION public.consume_streak_freeze(uuid, text, text, boolean, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_streak_freeze(uuid, text, text, boolean, uuid, integer) TO authenticated;

-- Wrapper sicuro per i client (solo self o parent o admin, no auto, niente metadati interni)
CREATE OR REPLACE FUNCTION public.use_my_streak_freeze(
  _student_id uuid,
  _freeze_type text,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
  remaining integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT (
    auth.uid() = _student_id
    OR public.is_parent_of(auth.uid(), _student_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  ok := public.consume_streak_freeze(_student_id, _freeze_type, _reason, false, NULL, NULL);

  IF NOT ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'limit_reached');
  END IF;

  -- Se è un freeze "homework" e la streak è 0, ripristiniamo a 1 per "salvare la serie"
  -- (in pratica i freeze evitano l'azzeramento futuro; non recuperano serie già perse)
  SELECT
    2 - COUNT(*) INTO remaining
  FROM public.streak_freezes
  WHERE student_id = _student_id
    AND freeze_type = _freeze_type
    AND used_at >= date_trunc('month', now())
    AND used_at < date_trunc('month', now()) + interval '1 month';

  RETURN jsonb_build_object('success', true, 'remaining', GREATEST(remaining, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.use_my_streak_freeze(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.use_my_streak_freeze(uuid, text, text) TO authenticated;

-- 3. Update homework streak: consuma freeze auto su submission in ritardo
CREATE OR REPLACE FUNCTION public.update_homework_streak()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  submission_date DATE;
  was_on_time BOOLEAN;
  student_group_id UUID;
  hw_deadline TIMESTAMPTZ;
  freeze_ok BOOLEAN;
BEGIN
  submission_date := DATE(NEW.submitted_at);

  SELECT gs.group_id INTO student_group_id
  FROM group_students gs
  WHERE gs.student_id = NEW.student_id
  LIMIT 1;

  SELECT COALESCE(hgd.due_date, h.due_date) INTO hw_deadline
  FROM homework h
  LEFT JOIN homework_group_deadlines hgd ON hgd.homework_id = h.id AND hgd.group_id = student_group_id
  WHERE h.id = NEW.homework_id;

  was_on_time := hw_deadline IS NULL OR NEW.submitted_at <= hw_deadline;

  SELECT homework_streak, best_homework_streak
  INTO current_streak, best_streak
  FROM student_streaks
  WHERE student_id = NEW.student_id;

  IF NOT FOUND THEN
    INSERT INTO student_streaks (student_id, homework_streak, last_homework_date, best_homework_streak)
    VALUES (NEW.student_id, CASE WHEN was_on_time THEN 1 ELSE 0 END, submission_date, CASE WHEN was_on_time THEN 1 ELSE 0 END);
    RETURN NEW;
  END IF;

  -- Submission in ritardo: prova a usare un freeze automatico prima di azzerare
  IF NOT was_on_time THEN
    freeze_ok := public.consume_streak_freeze(
      NEW.student_id, 'homework',
      'Compito in ritardo (auto-freeze)', true, NEW.homework_id, NULL
    );

    IF freeze_ok THEN
      -- Streak preservata: aggiorna solo la data
      UPDATE student_streaks
      SET last_homework_date = submission_date, updated_at = now()
      WHERE student_id = NEW.student_id;
      RETURN NEW;
    END IF;

    -- Nessun freeze disponibile: reset
    UPDATE student_streaks
    SET homework_streak = 0, last_homework_date = submission_date, updated_at = now()
    WHERE student_id = NEW.student_id;
    RETURN NEW;
  END IF;

  current_streak := COALESCE(current_streak, 0) + 1;
  IF current_streak > COALESCE(best_streak, 0) THEN
    best_streak := current_streak;
  END IF;

  UPDATE student_streaks
  SET homework_streak = current_streak,
      last_homework_date = submission_date,
      best_homework_streak = best_streak,
      updated_at = now()
  WHERE student_id = NEW.student_id;

  RETURN NEW;
END;
$function$;

-- 4. Update attendance streak: 'justified' non azzera (già così), 'absent' può consumare freeze
CREATE OR REPLACE FUNCTION public.update_group_attendance_streak()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
  last_lesson INTEGER;
  lesson_date DATE;
  prev_lesson_status TEXT;
  freeze_ok BOOLEAN;
BEGIN
  SELECT gls.lesson_date INTO lesson_date
  FROM group_lesson_schedule gls
  WHERE gls.group_id = NEW.group_id AND gls.lesson_number = NEW.lesson_number;

  -- Assenza non giustificata: prova freeze automatico
  IF NEW.status = 'absent' THEN
    freeze_ok := public.consume_streak_freeze(
      NEW.student_id, 'attendance',
      'Assenza non giustificata (auto-freeze)', true, NULL, NEW.lesson_number
    );

    IF NOT freeze_ok THEN
      UPDATE student_streaks
      SET attendance_streak = 0, updated_at = now()
      WHERE student_id = NEW.student_id;

      IF NOT FOUND THEN
        INSERT INTO student_streaks (student_id, attendance_streak, last_attendance_date, best_attendance_streak)
        VALUES (NEW.student_id, 0, lesson_date, 0);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- 'justified': non azzera, non incrementa
  IF NEW.status = 'justified' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'present' THEN
    SELECT attendance_streak, best_attendance_streak,
           COALESCE((SELECT MAX(lesson_number) FROM group_attendance
                     WHERE student_id = NEW.student_id AND group_id = NEW.group_id
                     AND lesson_number < NEW.lesson_number AND status = 'present'), 0)
    INTO current_streak, best_streak, last_lesson
    FROM student_streaks
    WHERE student_id = NEW.student_id;

    IF NOT FOUND THEN
      INSERT INTO student_streaks (student_id, attendance_streak, last_attendance_date, best_attendance_streak)
      VALUES (NEW.student_id, 1, lesson_date, 1);
      RETURN NEW;
    END IF;

    SELECT status INTO prev_lesson_status
    FROM group_attendance
    WHERE student_id = NEW.student_id
      AND group_id = NEW.group_id
      AND lesson_number = NEW.lesson_number - 1;

    IF prev_lesson_status IS NULL OR prev_lesson_status = 'present' OR prev_lesson_status = 'justified' THEN
      current_streak := COALESCE(current_streak, 0) + 1;
    ELSE
      current_streak := 1;
    END IF;

    IF current_streak > COALESCE(best_streak, 0) THEN
      best_streak := current_streak;
    END IF;

    UPDATE student_streaks
    SET attendance_streak = current_streak,
        last_attendance_date = lesson_date,
        best_attendance_streak = best_streak,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$function$;

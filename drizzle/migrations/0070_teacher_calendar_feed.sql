-- Lezioni dell'insegnante nel suo Google Calendar (o Apple Calendar, Outlook).
--
-- Dalla dashboard l'insegnante si iscrive a un link segreto
-- (.../functions/v1/teacher-calendar-feed/<token>.ics): l'edge function
-- risponde con le sue lezioni in formato iCalendar e il calendario lo rilegge
-- da solo, quindi spostamenti, nuovi gruppi e link dell'aula arrivano senza
-- fare nulla. Nel calendario non ci sono dati degli alunni.
--
-- Il token è l'unica credenziale (Google scarica il calendario senza account).
-- Lo legge e lo rigenera solo l'insegnante, con teacher_calendar_feed(): la
-- tabella non è accessibile dal client e l'edge function usa il service role.
-- last_fetched_at dice all'insegnante se il calendario è collegato.

CREATE TABLE IF NOT EXISTS public.teacher_calendar_feeds (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{48}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_fetched_at timestamptz
);

ALTER TABLE public.teacher_calendar_feeds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_calendar_feeds FROM anon, authenticated;
GRANT ALL ON public.teacher_calendar_feeds TO service_role;

-- Il link dell'insegnante (lo crea alla prima richiesta). p_rotate: ne crea uno
-- nuovo e quello vecchio smette di funzionare.
CREATE OR REPLACE FUNCTION public.teacher_calendar_feed(p_rotate boolean DEFAULT false)
RETURNS TABLE (token text, created_at timestamptz, last_fetched_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.mfa_ok() OR NOT public.has_role(v_uid, 'teacher'::app_role) THEN
    RAISE EXCEPTION 'Accesso negato' USING ERRCODE = '42501';
  END IF;

  IF p_rotate THEN
    DELETE FROM public.teacher_calendar_feeds WHERE teacher_id = v_uid;
  END IF;

  INSERT INTO public.teacher_calendar_feeds (teacher_id, token)
  VALUES (v_uid, encode(extensions.gen_random_bytes(24), 'hex'))
  ON CONFLICT (teacher_id) DO NOTHING;

  RETURN QUERY
  SELECT f.token, f.created_at, f.last_fetched_at
  FROM public.teacher_calendar_feeds f
  WHERE f.teacher_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_calendar_feed(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_calendar_feed(boolean) TO authenticated;

SELECT public.ensure_mfa_policies();
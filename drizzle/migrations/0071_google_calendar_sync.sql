-- lovable-cron-fallback-reviewed: the minute job only issues an HTTP call when trigger-marked connections or expired OAuth states exist; user-provided migration file applied as-is.
-- Lezioni dell'insegnante nel suo Google Calendar, aggiornate subito.
--
-- Oltre al link .ics (0067, che Google rilegge solo ogni qualche ora),
-- l'insegnante può collegare il suo account Google: TECHLAND crea nel suo
-- account il calendario «TECHLAND · Lezioni» (scope calendar.app.created, che
-- non dà accesso agli altri suoi calendari) e lo tiene allineato.
--
-- Come resta allineato:
--   - i trigger su lezioni, gruppi e corsi segnano dirty_at sulle connessioni
--     degli insegnanti coinvolti (vecchio e nuovo insegnante se il gruppo cambia
--     mano);
--   - ogni minuto pg_cron chiama l'edge function google-calendar-sync, ma solo
--     se c'è qualcosa da fare (connessioni segnate, o non allineate da un giorno);
--   - la funzione prende le connessioni con claim_google_calendar_syncs(), che
--     le "prenota" per 5 minuti così due giri non lavorano sulla stessa.
--
-- Il refresh token è una credenziale: le tabelle non sono accessibili dal
-- client e le usano solo le edge function (service role). L'insegnante vede
-- lo stato del collegamento tramite l'edge function google-calendar.

-- ── Connessioni ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Account Google collegato, solo da mostrare
  google_email text,
  refresh_token text NOT NULL,
  -- Il calendario «TECHLAND · Lezioni» creato nell'account dell'insegnante
  calendar_id text,
  -- revoked: accesso tolto da Google; calendar_missing: calendario eliminato
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'calendar_missing')),
  last_error text,
  -- Da risincronizzare (lo segnano i trigger)
  dirty_at timestamptz,
  -- Non prima di (prenotazione di un giro o attesa dopo un errore)
  retry_after timestamptz,
  last_synced_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_calendar_connections_due_idx
  ON public.google_calendar_connections (dirty_at)
  WHERE status = 'active';

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_connections FROM anon, authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;

-- ── Richieste di autorizzazione in corso (state + PKCE) ─────────────────────
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state text PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_oauth_states FROM anon, authenticated;
GRANT ALL ON public.google_oauth_states TO service_role;

-- ── Segnare gli insegnanti da risincronizzare ───────────────────────────────
CREATE OR REPLACE FUNCTION public.google_calendar_touch(p_teacher_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.google_calendar_connections
  SET dirty_at = clock_timestamp()
  WHERE teacher_id = ANY (p_teacher_ids) AND status = 'active';
$$;

REVOKE ALL ON FUNCTION public.google_calendar_touch(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_calendar_touch(uuid[]) TO service_role;

-- Lezioni: data, ora, titolo, numero o gruppo
CREATE OR REPLACE FUNCTION public.google_calendar_schedule_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_groups uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.google_calendar_connections) THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_groups := ARRAY[NEW.group_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_groups := ARRAY[OLD.group_id];
  ELSE
    v_groups := ARRAY[OLD.group_id, NEW.group_id];
  END IF;
  PERFORM public.google_calendar_touch(ARRAY(
    SELECT DISTINCT g.teacher_id FROM public.student_groups g
    WHERE g.id = ANY (v_groups) AND g.teacher_id IS NOT NULL));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS google_calendar_schedule_changed ON public.group_lesson_schedule;
CREATE TRIGGER google_calendar_schedule_changed
AFTER INSERT OR DELETE ON public.group_lesson_schedule
FOR EACH ROW EXECUTE FUNCTION public.google_calendar_schedule_changed();

DROP TRIGGER IF EXISTS google_calendar_schedule_updated ON public.group_lesson_schedule;
CREATE TRIGGER google_calendar_schedule_updated
AFTER UPDATE OF group_id, lesson_number, lesson_date, lesson_time, lesson_title ON public.group_lesson_schedule
FOR EACH ROW
WHEN ((OLD.group_id, OLD.lesson_number, OLD.lesson_date, OLD.lesson_time, OLD.lesson_title)
      IS DISTINCT FROM (NEW.group_id, NEW.lesson_number, NEW.lesson_date, NEW.lesson_time, NEW.lesson_title))
EXECUTE FUNCTION public.google_calendar_schedule_changed();

-- Gruppi: insegnante, titolo, orario, link dell'aula, corso, archiviazione
CREATE OR REPLACE FUNCTION public.google_calendar_group_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.google_calendar_connections) THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.google_calendar_touch(ARRAY[NEW.teacher_id]);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.google_calendar_touch(ARRAY[OLD.teacher_id]);
  ELSE
    PERFORM public.google_calendar_touch(ARRAY[OLD.teacher_id, NEW.teacher_id]);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS google_calendar_group_changed ON public.student_groups;
CREATE TRIGGER google_calendar_group_changed
AFTER INSERT OR DELETE ON public.student_groups
FOR EACH ROW EXECUTE FUNCTION public.google_calendar_group_changed();

DROP TRIGGER IF EXISTS google_calendar_group_updated ON public.student_groups;
CREATE TRIGGER google_calendar_group_updated
AFTER UPDATE OF teacher_id, title, lesson_time, teacher_meeting_link, course_id, status, archived_at ON public.student_groups
FOR EACH ROW
WHEN ((OLD.teacher_id, OLD.title, OLD.lesson_time, OLD.teacher_meeting_link, OLD.course_id, OLD.status, OLD.archived_at)
      IS DISTINCT FROM (NEW.teacher_id, NEW.title, NEW.lesson_time, NEW.teacher_meeting_link, NEW.course_id, NEW.status, NEW.archived_at))
EXECUTE FUNCTION public.google_calendar_group_changed();

-- Corsi: nome ed emoji compaiono nel titolo degli eventi
CREATE OR REPLACE FUNCTION public.google_calendar_course_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.google_calendar_connections) THEN
    RETURN NULL;
  END IF;
  PERFORM public.google_calendar_touch(ARRAY(
    SELECT DISTINCT g.teacher_id FROM public.student_groups g
    WHERE g.course_id = NEW.id AND g.teacher_id IS NOT NULL));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS google_calendar_course_updated ON public.courses;
CREATE TRIGGER google_calendar_course_updated
AFTER UPDATE OF title, emoji ON public.courses
FOR EACH ROW
WHEN ((OLD.title, OLD.emoji) IS DISTINCT FROM (NEW.title, NEW.emoji))
EXECUTE FUNCTION public.google_calendar_course_changed();

-- ── Prenotazione delle connessioni da sincronizzare ─────────────────────────
CREATE OR REPLACE FUNCTION public.claim_google_calendar_syncs(p_limit integer DEFAULT 20)
RETURNS SETOF public.google_calendar_connections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.google_calendar_connections c
  SET retry_after = now() + interval '5 minutes'
  WHERE c.teacher_id IN (
    SELECT d.teacher_id FROM public.google_calendar_connections d
    WHERE d.status = 'active'
      AND (d.dirty_at IS NOT NULL OR d.last_synced_at IS NULL OR d.last_synced_at < now() - interval '1 day')
      AND (d.retry_after IS NULL OR d.retry_after <= now())
    ORDER BY d.dirty_at NULLS LAST, d.last_synced_at NULLS FIRST
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING c.*;
$$;

REVOKE ALL ON FUNCTION public.claim_google_calendar_syncs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_calendar_syncs(integer) TO service_role;

-- Pulizia: le autorizzazioni non concluse scadono dopo 15 minuti
CREATE OR REPLACE FUNCTION public.cleanup_google_oauth_states()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.google_oauth_states WHERE created_at < now() - interval '15 minutes';
$$;

REVOKE ALL ON FUNCTION public.cleanup_google_oauth_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_google_oauth_states() TO service_role;

-- ── Job ogni minuto ─────────────────────────────────────────────────────────
INSERT INTO public.internal_cron_tokens(name) VALUES ('google-calendar-sync') ON CONFLICT DO NOTHING;

-- Lista dei job attesi di 0061 più la sincronizzazione Google Calendar
CREATE OR REPLACE FUNCTION public.cron_expected_jobs()
RETURNS TABLE(jobname text, max_age interval)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  VALUES
    ('send-lesson-reminders-30min'::text, interval '1 hour'),
    ('send-payment-reminders-daily', interval '26 hours'),
    ('blog-auto-publish-hourly', interval '2 hours'),
    ('data-retention-monthly-scan', interval '32 days'),
    ('cleanup-old-logs-nightly', interval '26 hours'),
    ('cron-health-check-hourly', interval '2 hours'),
    ('student-risk-check-daily', interval '26 hours'),
    ('subscription-pause-check-daily', interval '26 hours'),
    ('monthly-report-monthly', interval '32 days'),
    ('satisfaction-survey-daily', interval '26 hours'),
    ('school-closure-notice-daily', interval '26 hours'),
    ('google-calendar-sync-minute', interval '15 minutes')
$$;

-- La chiamata parte solo se c'è qualcosa da fare: senza insegnanti collegati
-- il job non invoca nessuna edge function.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'google-calendar-sync-minute';
    PERFORM cron.schedule(
      'google-calendar-sync-minute',
      '* * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://aedpckxjyyklqwrzrnmg.supabase.co/functions/v1/google-calendar-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHBja3hqeXlrbHF3cnpybm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTkwNjUsImV4cCI6MjA4MTQ3NTA2NX0.rRQxCIrgXCFQODz6vs20mWWVVWFEq2RrYqAEIZVZG40',
          'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'google-calendar-sync')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      )
      WHERE EXISTS (
        SELECT 1 FROM public.google_calendar_connections
        WHERE status = 'active'
          AND (dirty_at IS NOT NULL OR last_synced_at IS NULL OR last_synced_at < now() - interval '1 day')
          AND (retry_after IS NULL OR retry_after <= now())
      )
         OR EXISTS (SELECT 1 FROM public.google_oauth_states WHERE created_at < now() - interval '15 minutes');
      $job$
    );
  END IF;
END
$cron$;

SELECT public.ensure_mfa_policies();
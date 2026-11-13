-- Correzioni dell'audit di sicurezza (SECURITY_AUDIT.md, punti A-01 e M-01).
--
-- A-01  get_leaderboard era chiamabile senza login (SECURITY DEFINER, nessun
--       controllo su auth.uid(), nessun REVOKE) e con _limit libero: chiunque
--       poteva scaricare nome, cognome e id di tutti gli studenti. Ora risponde
--       solo a un utente autenticato (con 2FA se gli è richiesta) e restituisce
--       al massimo 100 righe. Firma e colonne restano uguali: la pagina
--       Classifica non cambia.
--
-- M-01  la policy di INSERT su homework_submissions controllava solo studente e
--       iscrizione: con una chiamata diretta lo studente poteva inserirsi una
--       consegna già valutata (voto, feedback dell'insegnante, punteggio
--       automatico). Ora l'INSERT diretto accetta solo una consegna "pending"
--       senza campi di valutazione e con un file nella propria cartella. Le RPC
--       submit_homework_code / submit_homework_file e la valutazione di
--       insegnanti e admin non passano da questa policy.

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  _filter_type text DEFAULT 'global',
  _filter_id uuid DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  full_name text,
  avatar_id integer,
  total_points integer,
  role text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_points DESC, p.created_at ASC) as rank,
    p.id as user_id,
    p.full_name,
    p.avatar_id,
    p.total_points,
    p.role
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND public.mfa_ok()
    AND p.role = 'student'
    AND (
      _filter_type = 'global'
      OR (
        _filter_type = 'course' AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.student_id = p.id AND e.course_id = _filter_id AND e.status = 'active'
        )
      )
      OR (
        _filter_type = 'group' AND EXISTS (
          SELECT 1 FROM public.group_students gs
          WHERE gs.student_id = p.id AND gs.group_id = _filter_id
        )
      )
    )
  ORDER BY p.total_points DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
$$;

-- Su Supabase anon ha un permesso esplicito: revocare solo da PUBLIC non basta
REVOKE ALL ON FUNCTION public.get_leaderboard(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, uuid, integer) TO authenticated, service_role;

DROP POLICY IF EXISTS "Students can insert their submissions" ON public.homework_submissions;
CREATE POLICY "Students can insert their submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.is_enrolled_for_homework(auth.uid(), homework_id)
  AND status = 'pending'
  AND grade IS NULL
  AND teacher_feedback IS NULL
  AND feedback_at IS NULL
  AND auto_score IS NULL
  AND test_results IS NULL
  AND tests_run_at IS NULL
  AND (
    file_url IS NULL
    OR (left(file_url, length(auth.uid()::text) + 1) = auth.uid()::text || '/'
        AND position('..' IN file_url) = 0)
  )
);

-- Restrict scheduled_lessons SELECT to authenticated users (admins/teachers/students/parents)
DROP POLICY IF EXISTS "Anyone can view scheduled_lessons" ON public.scheduled_lessons;
CREATE POLICY "Authenticated users can view scheduled_lessons"
ON public.scheduled_lessons
FOR SELECT
TO authenticated
USING (true);

-- Tighten page_views UPDATE: restrict to the same anonymous session that inserted the row,
-- by adding a session-id match. The session_id is generated client-side and stored only in
-- the user's browser, so other users cannot guess and update arbitrary rows.
DROP POLICY IF EXISTS "Anyone can update recent page views" ON public.page_views;
CREATE POLICY "Owners can update recent page views"
ON public.page_views
FOR UPDATE
USING (
  entered_at > (now() - interval '2 hours')
  AND exited_at IS NULL
  AND session_id = current_setting('request.headers', true)::jsonb->>'x-session-id'
)
WITH CHECK (
  entered_at > (now() - interval '2 hours')
  AND session_id = current_setting('request.headers', true)::jsonb->>'x-session-id'
);

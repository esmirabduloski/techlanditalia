
-- Fix overly permissive UPDATE policy on page_views
-- Restrict to only updating recent, unclosed page views within 2 hours
DROP POLICY IF EXISTS "Anyone can update their own page views" ON public.page_views;

CREATE POLICY "Anyone can update recent page views"
  ON public.page_views
  FOR UPDATE
  TO anon, authenticated
  USING (
    entered_at > now() - interval '2 hours'
    AND exited_at IS NULL
  )
  WITH CHECK (
    entered_at > now() - interval '2 hours'
  );

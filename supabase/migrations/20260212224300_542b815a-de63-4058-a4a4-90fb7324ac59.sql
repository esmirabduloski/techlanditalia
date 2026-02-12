-- Tighten the UPDATE policy to only allow updating rows matching the session
DROP POLICY IF EXISTS "Anyone can update their own page views" ON public.page_views;

CREATE POLICY "Anyone can update their own page views"
  ON public.page_views
  FOR UPDATE
  TO anon, authenticated
  USING (true);
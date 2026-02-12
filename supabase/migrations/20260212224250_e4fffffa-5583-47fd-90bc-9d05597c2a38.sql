-- Drop the existing restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;

CREATE POLICY "Anyone can insert page views"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (session_id IS NOT NULL AND page_url IS NOT NULL);

-- Also fix the UPDATE policy to be permissive so updates don't fail
DROP POLICY IF EXISTS "Anyone can update their own page views" ON public.page_views;

CREATE POLICY "Anyone can update their own page views"
  ON public.page_views
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated owners can view their recent page views" ON public.page_views;
CREATE POLICY "Authenticated owners can view their recent page views"
ON public.page_views
FOR SELECT
TO authenticated
USING (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND entered_at > (now() - interval '2 hours')
);
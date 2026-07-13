DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
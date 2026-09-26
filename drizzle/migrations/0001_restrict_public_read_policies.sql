-- Replace tautological USING (true) SELECT policies with authenticated-only reads.
-- These tables (gamification catalog, badges, featured products) are only read
-- from logged-in areas of the app, so restricting to authenticated users is safe.

DROP POLICY IF EXISTS "Anyone can view levels" ON public.gamification_levels;
CREATE POLICY "Authenticated users can view levels"
ON public.gamification_levels
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Authenticated users can view badges"
ON public.badges
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view featured products" ON public.featured_products;
CREATE POLICY "Authenticated users can view featured products"
ON public.featured_products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
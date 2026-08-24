DROP POLICY IF EXISTS "Admins can view page views" ON public.page_views;
CREATE POLICY "Admins can view page views"
ON public.page_views FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
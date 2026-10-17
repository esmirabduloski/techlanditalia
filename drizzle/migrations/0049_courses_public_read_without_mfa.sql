DROP POLICY IF EXISTS mfa_required ON public.courses;
CREATE POLICY mfa_required_insert ON public.courses AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY mfa_required_update ON public.courses AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY mfa_required_delete ON public.courses AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT public.mfa_ok()));
ALTER POLICY "Authenticated read ai consent versions"
ON public.ai_consent_versions
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
COMMENT ON POLICY "Authenticated read ai consent versions" ON public.ai_consent_versions IS 'Shared consent-version metadata (version and publication date only), intentionally readable by signed-in users; MFA restrictions remain enforced by the separate restrictive policy.';
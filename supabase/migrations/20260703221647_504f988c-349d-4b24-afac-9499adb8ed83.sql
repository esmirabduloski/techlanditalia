
-- Fix referrals INSERT policy: eliminate WITH CHECK (true) and prevent spoofing
DROP POLICY IF EXISTS "Anyone can submit referral" ON public.referrals;
CREATE POLICY "Anyone can submit referral"
ON public.referrals
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND rewarded_at IS NULL
  AND rewarded_by IS NULL
  AND reward_reason IS NULL
  AND referrer_code IS NOT NULL
  AND length(referrer_code) BETWEEN 4 AND 32
  AND (referred_profile_id IS NULL OR referred_profile_id = auth.uid())
  AND (referred_email IS NULL OR length(referred_email) <= 254)
  AND (notes IS NULL OR length(notes) <= 500)
  AND (source_url IS NULL OR length(source_url) <= 500)
);

-- Harden analytics INSERT policies against poisoning by capping sizes and constraining shapes.
-- Keep anonymous inserts (client tracking) but reject oversized / malformed payloads.

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id IS NOT NULL AND length(session_id) BETWEEN 8 AND 128
  AND event_type IS NOT NULL AND length(event_type) <= 64
  AND event_category IS NOT NULL AND length(event_category) <= 64
  AND event_action IS NOT NULL AND length(event_action) <= 64
  AND (event_label IS NULL OR length(event_label) <= 128)
  AND (page_url IS NULL OR length(page_url) <= 500)
  AND (page_title IS NULL OR length(page_title) <= 300)
  AND (referrer IS NULL OR length(referrer) <= 500)
  AND ((user_id IS NULL) OR (user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id IS NOT NULL AND length(session_id) BETWEEN 8 AND 128
  AND page_url IS NOT NULL AND length(page_url) <= 500
  AND (page_title IS NULL OR length(page_title) <= 300)
  AND (referrer IS NULL OR length(referrer) <= 500)
  AND (device_type IS NULL OR length(device_type) <= 32)
  AND (utm_source IS NULL OR length(utm_source) <= 128)
  AND (utm_medium IS NULL OR length(utm_medium) <= 128)
  AND (utm_campaign IS NULL OR length(utm_campaign) <= 128)
  AND ((user_id IS NULL) OR (user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Anyone can insert conversion funnels" ON public.conversion_funnels;
CREATE POLICY "Anyone can insert conversion funnels"
ON public.conversion_funnels
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id IS NOT NULL AND length(session_id) BETWEEN 8 AND 128
  AND funnel_name IS NOT NULL AND length(funnel_name) <= 64
  AND step_name IS NOT NULL AND length(step_name) <= 64
  AND step_number IS NOT NULL AND step_number BETWEEN 0 AND 100
  AND ((user_id IS NULL) OR (user_id = auth.uid()))
);

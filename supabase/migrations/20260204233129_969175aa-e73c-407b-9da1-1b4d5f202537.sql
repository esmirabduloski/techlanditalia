-- Tighten INSERT policies that were previously `WITH CHECK (true)` to satisfy linter and reduce abuse.

-- analytics_events
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (
  session_id IS NOT NULL
  AND event_type IS NOT NULL
  AND event_category IS NOT NULL
  AND event_action IS NOT NULL
);

-- conversion_funnels
DROP POLICY IF EXISTS "Anyone can insert conversion funnels" ON public.conversion_funnels;
CREATE POLICY "Anyone can insert conversion funnels"
ON public.conversion_funnels
FOR INSERT
WITH CHECK (
  session_id IS NOT NULL
  AND funnel_name IS NOT NULL
  AND step_name IS NOT NULL
  AND step_number IS NOT NULL
);

-- page_views
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (
  session_id IS NOT NULL
  AND page_url IS NOT NULL
);
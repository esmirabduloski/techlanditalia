-- Remove the overly permissive INSERT policy on trial_bookings
-- The edge function uses service_role which bypasses RLS, so this policy is unnecessary
-- and creates a security vulnerability allowing direct inserts with the anon key

DROP POLICY IF EXISTS "Service role can insert bookings" ON public.trial_bookings;
-- Remove redundant/conflicting SELECT policies on trial_bookings
-- Keep only the properly scoped admin access policy

-- Drop the redundant policies
DROP POLICY IF EXISTS "Deny public read access" ON public.trial_bookings;
DROP POLICY IF EXISTS "Only admins can read bookings" ON public.trial_bookings;

-- Keep "Admins can read all bookings" as the single SELECT policy
-- This is already correct: has_role(auth.uid(), 'admin'::app_role)
-- No action needed for this policy as it already exists and is secure
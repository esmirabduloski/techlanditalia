-- Drop the overly permissive public insert policy
DROP POLICY IF EXISTS "Anyone can submit booking request" ON public.trial_bookings;

-- Create a new policy that only allows service role to insert
-- This ensures bookings can only be created through the Edge Function
CREATE POLICY "Service role can insert bookings"
ON public.trial_bookings
FOR INSERT
TO service_role
WITH CHECK (true);

-- Note: The Edge Function uses service_role key, so it can insert
-- Direct client-side inserts will be blocked
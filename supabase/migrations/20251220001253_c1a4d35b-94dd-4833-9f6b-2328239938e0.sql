-- Add explicit DENY policy for anonymous/public access to trial_bookings
-- This ensures no unauthenticated users can read booking data
CREATE POLICY "Deny public read access"
ON public.trial_bookings
FOR SELECT
TO anon
USING (false);

-- Also add explicit deny for authenticated non-admins
-- (redundant since admin policy already covers this, but makes security explicit)
CREATE POLICY "Only admins can read bookings"
ON public.trial_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
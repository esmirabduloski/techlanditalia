-- Add explicit DENY policies for user_roles table write operations
-- This ensures roles can only be managed through admin-controlled server-side functions

-- Prevent all INSERT operations from authenticated users
CREATE POLICY "Prevent direct role insertion"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Prevent all UPDATE operations from authenticated users
CREATE POLICY "Prevent role modification"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Prevent all DELETE operations from authenticated users
CREATE POLICY "Prevent role deletion"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);
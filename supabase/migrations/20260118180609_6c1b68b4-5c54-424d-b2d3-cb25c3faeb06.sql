-- Fix newsletter_subscribers: Ensure only admins can access
-- First, drop any overly permissive policies if they exist
DROP POLICY IF EXISTS "Anyone can view newsletter_subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Public can view newsletter_subscribers" ON public.newsletter_subscribers;

-- Verify the admin-only policies exist (recreate if needed)
DROP POLICY IF EXISTS "Admins can view all subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view all subscribers" 
ON public.newsletter_subscribers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can delete subscribers" 
ON public.newsletter_subscribers 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix profiles table: Ensure proper access control
-- Remove any overly permissive policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;
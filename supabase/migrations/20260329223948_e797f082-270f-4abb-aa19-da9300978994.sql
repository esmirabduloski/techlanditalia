-- Fix job_applications: replace overly permissive INSERT policy with basic validation
DROP POLICY IF EXISTS "Anyone can insert job applications" ON public.job_applications;

CREATE POLICY "Anyone can insert job applications with validation"
ON public.job_applications FOR INSERT
TO public
WITH CHECK (
  nome IS NOT NULL AND length(trim(nome)) >= 2
  AND email IS NOT NULL AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND posizione IS NOT NULL AND length(trim(posizione)) >= 2
  AND messaggio IS NOT NULL AND length(trim(messaggio)) >= 10
);
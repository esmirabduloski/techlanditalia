-- Add INSERT policy for teachers to create their own profile
CREATE POLICY "Teachers can insert own profile"
ON public.teacher_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
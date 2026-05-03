-- Restrict lessons, lesson_tasks, homework SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Anyone can view tasks" ON public.lesson_tasks;
DROP POLICY IF EXISTS "Anyone can view homework" ON public.homework;

CREATE POLICY "Authenticated users can view lessons"
ON public.lessons FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view tasks"
ON public.lesson_tasks FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view homework"
ON public.homework FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
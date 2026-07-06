
-- 1) courses: only visible courses publicly readable; admins/teachers see all via other paths
DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
CREATE POLICY "Anyone can view visible courses"
ON public.courses FOR SELECT
USING (is_visible = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) profiles insert: prevent role/parent_id self-escalation on INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = id
  AND role = 'student'
  AND parent_id IS NULL
);

-- 3) site_settings: gate public read to explicit is_public rows
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
-- Preserve existing behaviour for known public setting(s)
UPDATE public.site_settings SET is_public = true WHERE key = 'lavora_con_noi_visible';

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view public site settings"
ON public.site_settings FOR SELECT
USING (is_public = true OR public.has_role(auth.uid(), 'admin'::app_role));

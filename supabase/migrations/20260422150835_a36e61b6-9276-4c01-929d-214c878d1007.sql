
-- Find and drop any broad public SELECT policies on lesson material buckets
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd='SELECT'
      AND qual LIKE '%lesson-material%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Replace with authenticated-only SELECT (CDN public URLs still work for anon)
CREATE POLICY "Authenticated view roblox lesson material"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'roblox-lesson-material');

CREATE POLICY "Authenticated view python lesson material"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'python-lesson-material');

CREATE POLICY "Authenticated view python pro lesson material"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'python-pro-lesson-material');

CREATE POLICY "Authenticated view ro2 lesson material"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ro2-lesson-material');

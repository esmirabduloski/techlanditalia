-- Fix 1: conversion_funnels UPDATE policy (session_id = session_id always true)
DROP POLICY IF EXISTS "Anyone can update their own funnel steps" ON public.conversion_funnels;

-- Disable UPDATE entirely since funnel steps are insert-only analytics
-- If updates are needed, they should only mark completion
CREATE POLICY "Anyone can update their own funnel steps"
ON public.conversion_funnels FOR UPDATE
USING (false)
WITH CHECK (false);

-- Fix 2: homework-files storage bucket - add owner-based restrictions
DROP POLICY IF EXISTS "Students can upload their homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can update their homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their homework files" ON storage.objects;

CREATE POLICY "Students upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins and teachers full access to homework files
CREATE POLICY "Admins manage homework files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'homework-files'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Teachers view student homework files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND public.has_role(auth.uid(), 'teacher')
);

-- Allow parents to view their children's homework files
CREATE POLICY "Parents view children homework files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND auth.uid() IS NOT NULL
  AND public.is_parent_of(auth.uid(), (storage.foldername(name))[1]::uuid)
);
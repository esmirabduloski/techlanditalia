-- Remove plain_password column from profiles table
-- This column is no longer needed as children will use the same password as their parent
ALTER TABLE public.profiles DROP COLUMN plain_password;
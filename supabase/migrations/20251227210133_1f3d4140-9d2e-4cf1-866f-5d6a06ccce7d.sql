-- Add username and plain_password columns to profiles for student accounts
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE,
ADD COLUMN plain_password text;

-- Create index for username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

-- Add comment explaining the plain_password column
COMMENT ON COLUMN public.profiles.plain_password IS 'Plain text password for student accounts, set by parents. Only used for students.';
COMMENT ON COLUMN public.profiles.username IS 'Username for student accounts, set by parents. Used for student login.';
-- 1. Change parent_id FK from SET NULL to CASCADE so deleting a parent profile
--    automatically removes child profiles.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_parent_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Trigger function: when a profile is deleted, also delete the matching auth.users row.
--    This guarantees there are never orphan auth users (or orphan profiles)
--    no matter how the deletion is initiated.
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Safe even if auth.users row is already gone (cascade source): WHERE matches nothing.
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_auth_user_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_delete_auth_user_on_profile_delete
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.delete_auth_user_on_profile_delete();
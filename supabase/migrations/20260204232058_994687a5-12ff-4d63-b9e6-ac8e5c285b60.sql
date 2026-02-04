-- Remove the problematic recursive policy
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;

-- Create a safer policy that doesn't cause recursion
-- Parents can view profiles where the profile's parent_id matches their uid
-- This is safe because we're checking a column value, not doing a subquery on the same table
CREATE POLICY "Parents can view children profiles"
ON public.profiles
FOR SELECT
USING (parent_id = auth.uid());
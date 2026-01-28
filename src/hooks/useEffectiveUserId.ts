import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

/**
 * Hook that returns the effective user ID to use for data fetching.
 * When admin is impersonating a user, returns the impersonated user's ID.
 * Otherwise, returns the real user's ID.
 */
export function useEffectiveUserId() {
  const { user, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();

  // Only allow impersonation if user is admin
  const effectiveUserId = isAdmin && isImpersonating && impersonatedUser
    ? impersonatedUser.id
    : user?.id;

  return {
    effectiveUserId,
    realUserId: user?.id,
    isImpersonating: isAdmin && isImpersonating,
    impersonatedUser,
    impersonatedRole: impersonatedUser?.role
  };
}

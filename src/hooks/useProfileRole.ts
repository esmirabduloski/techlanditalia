import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/integrations/supabase/lazyClient';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

export type ProfileRole = 'student' | 'parent' | 'teacher' | 'admin' | null;

/**
 * Ruolo del profilo effettivo (quello impersonato, se l'admin sta impersonando)
 * e se ha figli collegati. Una sola query in cache per navbar, barra in basso e chat.
 * Client Supabase caricato a richiesta: il Layout gira anche sulla home.
 */
export function useProfileRole() {
  const { effectiveUserId } = useEffectiveUserId();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-role', effectiveUserId],
    enabled: !!effectiveUserId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = await getSupabase();
      const [{ data: profile }, { data: children }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', effectiveUserId!).maybeSingle(),
        supabase.from('profiles').select('id').eq('parent_id', effectiveUserId!).limit(1),
      ]);
      return {
        role: (profile?.role ?? null) as ProfileRole,
        hasChildren: (children?.length ?? 0) > 0,
      };
    },
  });

  return {
    role: data?.role ?? null,
    isParent: data?.role === 'parent',
    hasChildren: data?.hasChildren ?? false,
    isLoading: !!effectiveUserId && isLoading,
  };
}

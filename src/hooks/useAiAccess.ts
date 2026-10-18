import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { type AiAccess, fetchMyAiAccess } from '@/lib/aiConsents';

/** Se l'utente collegato può usare gli strumenti AI (my_ai_access, migrazione 0054). */
export function useAiAccess() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AiAccess | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setAccess(null);
      setLoading(false);
      return;
    }
    setAccess(await fetchMyAiAccess());
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { access, loading, reload, userId: user?.id ?? null };
}

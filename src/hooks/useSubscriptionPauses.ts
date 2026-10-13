import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPauseActive, romeTodayIso, type SubscriptionPauseWithStudent } from '@/lib/subscriptionPause';

/**
 * Pause dell'abbonamento aperte (in corso o programmate), per i badge
 * IN PAUSA di CRM e Utenti.
 */
export function useSubscriptionPauses() {
  const [pauses, setPauses] = useState<SubscriptionPauseWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscription_pauses')
      .select('*, student:profiles!subscription_pauses_student_id_fkey(id, full_name, parent_id)')
      .is('ended_at', null);
    if (!error) setPauses((data ?? []) as unknown as SubscriptionPauseWithStudent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byStudent = useMemo(() => new Map(pauses.map((p) => [p.student_id, p])), [pauses]);

  /**
   * Pause in corso della famiglia del lead: il lead è collegato al genitore
   * (pause dei figli) o direttamente allo studente.
   */
  const activeForProfile = useCallback(
    (profileId: string | null | undefined) => {
      if (!profileId) return [];
      const today = romeTodayIso();
      return pauses.filter(
        (p) => isPauseActive(p, today) && (p.student_id === profileId || p.student?.parent_id === profileId),
      );
    },
    [pauses],
  );

  return { pauses, byStudent, activeForProfile, loading, reload: load };
}

export type SubscriptionPausesState = ReturnType<typeof useSubscriptionPauses>;

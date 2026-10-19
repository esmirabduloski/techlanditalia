/**
 * Mappa delle competenze di uno studente (vedi src/lib/skillMap.ts). Studente,
 * genitore e insegnante usano la stessa chiave, e la conferma dell'insegnante
 * la rinfresca. Se la migrazione 0062 non è ancora applicata (o l'utente non
 * può vedere lo studente) la query dà null e le schede restano nascoste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SkillEvidenceRow, SkillLevel } from '@/lib/skillMap';
import { skillMapClient } from '@/lib/skillMapClient';

const STALE_TIME = 60_000;

export const skillMapKey = (studentId: string | undefined) => ['skill-map', studentId] as const;

export function useSkillMap(studentId: string | undefined) {
  return useQuery({
    queryKey: skillMapKey(studentId),
    enabled: !!studentId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<SkillEvidenceRow[] | null> => {
      const { data, error } = await skillMapClient.rpc('student_skill_evidence', { p_student_id: studentId! });
      if (error) {
        console.warn('Mappa delle competenze non disponibile:', error.message);
        return null;
      }
      return (data ?? []) as SkillEvidenceRow[];
    },
  });
}

export type SkillAssessmentInput = {
  concept: string;
  level: SkillLevel;
  note: string | null;
  assessedBy: string;
};

/** Conferma (o cambia) il livello di un concetto, oppure torna al calcolo automatico. */
export function useSkillAssessmentMutations(studentId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: skillMapKey(studentId) });

  const save = useMutation({
    mutationFn: async ({ concept, level, note, assessedBy }: SkillAssessmentInput) => {
      const { error } = await skillMapClient
        .from('student_skill_assessments')
        .upsert(
          { student_id: studentId, concept, level, note, assessed_by: assessedBy },
          { onConflict: 'student_id,concept' },
        );
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const reset = useMutation({
    mutationFn: async (concept: string) => {
      const { error } = await skillMapClient
        .from('student_skill_assessments')
        .delete()
        .eq('student_id', studentId)
        .eq('concept', concept);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { save, reset };
}

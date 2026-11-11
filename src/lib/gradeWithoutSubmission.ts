import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0080_grade_without_submission: RPC per valutare un compito non consegnato.
type Functions = Database['public']['Functions'];
type GradeWithoutSubmissionDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Functions & {
      grade_homework_without_submission: {
        Args: { _homework_id: string; _student_id: string; _grade: number; _feedback?: string | null };
        Returns: { success?: boolean; error?: string } | null;
      };
    };
  };
};

const client = supabase as unknown as SupabaseClient<GradeWithoutSubmissionDatabase>;

export const GRADE_WITHOUT_SUBMISSION_ERRORS: Record<string, string> = {
  not_authenticated: 'Devi accedere di nuovo.',
  mfa_required: 'Completa la verifica in due passaggi per valutare.',
  invalid_grade: 'Il voto deve essere tra 0 e 100.',
  too_large: 'Il commento è troppo lungo.',
  not_found: 'Compito non trovato.',
  not_allowed: 'Non puoi valutare questo studente per questo compito.',
  not_enrolled: 'Lo studente non è iscritto al corso di questo compito.',
  already_submitted: 'Lo studente ha già una consegna per questo compito: valutala dall\'elenco.',
  not_available: 'Funzione non ancora attiva: manca l\'aggiornamento del database.',
};

/** Consegna con qualcosa dentro (file o note/codice): non è una valutazione senza consegna. */
export function hasDelivery(submission: { file_url?: string | null; notes?: string | null } | null | undefined): boolean {
  return !!submission && (!!submission.file_url || !!submission.notes);
}

/** Lo studente non può più cambiare la consegna: valutata/approvata e con qualcosa consegnato. */
export function isSubmissionLocked(
  submission: { status: string; file_url?: string | null; notes?: string | null } | null | undefined,
): boolean {
  return !!submission && ['graded', 'approved'].includes(submission.status) && hasDelivery(submission);
}

/** Valuta un compito che lo studente non ha consegnato. Restituisce un messaggio d'errore o null. */
export async function gradeWithoutSubmission(params: {
  homeworkId: string;
  studentId: string;
  grade: number;
  feedback: string;
}): Promise<string | null> {
  const { data, error } = await client.rpc('grade_homework_without_submission', {
    _homework_id: params.homeworkId,
    _student_id: params.studentId,
    _grade: params.grade,
    _feedback: params.feedback.trim() || null,
  });
  if (error) {
    // Funzione assente: la migrazione 0080 non è ancora applicata
    if (error.code === 'PGRST202' || error.code === '42883') return GRADE_WITHOUT_SUBMISSION_ERRORS.not_available;
    return error.message || 'Impossibile salvare la valutazione';
  }
  if (!data?.success) {
    return GRADE_WITHOUT_SUBMISSION_ERRORS[data?.error ?? ''] ?? 'Impossibile salvare la valutazione';
  }
  return null;
}

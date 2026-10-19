import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { SkillAssessment, SkillEvidenceRow } from '@/lib/skillMap';

type Tables = Database['public']['Tables'];
type LessonsTable = Tables['lessons'];

// Reuse the authenticated client; do not change generated types for a pending migration.
type SkillMapDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<Tables, 'lessons'> & {
      lessons: {
        Row: LessonsTable['Row'] & { concepts: string[] };
        Insert: LessonsTable['Insert'] & { concepts?: string[] };
        Update: LessonsTable['Update'] & { concepts?: string[] };
        Relationships: LessonsTable['Relationships'];
      };
      student_skill_assessments: {
        Row: SkillAssessment;
        Insert: Pick<SkillAssessment, 'student_id' | 'concept' | 'level'> & Partial<SkillAssessment>;
        Update: Partial<SkillAssessment>;
        Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      student_skill_evidence: {
        Args: { p_student_id: string };
        Returns: SkillEvidenceRow[];
      };
    };
  };
};

export const skillMapClient = supabase as unknown as SupabaseClient<SkillMapDatabase>;

/** Colonna o tabella non ancora create: la migrazione 0062 non è applicata. */
export function isMissingSchemaError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === '42P01' || error?.code === 'PGRST202' || error?.code === 'PGRST204';
}

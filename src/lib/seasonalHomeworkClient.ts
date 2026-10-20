import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { SeasonalHomeworkColumns, SeasonalTheme } from '@/lib/seasonalHomework';

type Tables = Database['public']['Tables'];
type HomeworkTable = Tables['homework'];

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0066_seasonal_homework: tabella dei temi, tema e corso su homework, lesson_id facoltativo.
type SeasonalHomeworkDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Tables, 'homework'> & {
      homework: {
        Row: Omit<HomeworkTable['Row'], 'lesson_id'> & SeasonalHomeworkColumns & { lesson_id: string | null };
        Insert: Omit<HomeworkTable['Insert'], 'lesson_id'> & Partial<SeasonalHomeworkColumns> & { lesson_id?: string | null };
        Update: Omit<HomeworkTable['Update'], 'lesson_id'> & Partial<SeasonalHomeworkColumns> & { lesson_id?: string | null };
        Relationships: HomeworkTable['Relationships'];
      };
      seasonal_themes: {
        Row: SeasonalTheme;
        Insert: Pick<SeasonalTheme, 'name'> & Partial<SeasonalTheme>;
        Update: Partial<SeasonalTheme>;
        Relationships: [];
      };
    };
  };
};

export const seasonalClient = supabase as unknown as SupabaseClient<SeasonalHomeworkDatabase>;

export type SeasonalHomeworkRow = SeasonalHomeworkDatabase['public']['Tables']['homework']['Row'];

/** Tabella o colonna non ancora create: la migrazione 0066 non è applicata. */
export function isMissingSeasonalSchema(error: { code?: string } | null | undefined): boolean {
  return ['42703', '42P01', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
}

/** Temi in ordine di stagione; null se la migrazione non è ancora applicata. */
export async function fetchSeasonalThemes(): Promise<SeasonalTheme[] | null> {
  const { data, error } = await seasonalClient
    .from('seasonal_themes')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) {
    if (!isMissingSeasonalSchema(error)) console.warn('Temi stagionali non disponibili:', error.message);
    return null;
  }
  return data ?? [];
}

/** Compiti stagionali di un corso che non sono in nessuna lezione (per i backup del corso). */
export async function fetchArchivedSeasonalHomework(courseId: string): Promise<SeasonalHomeworkRow[]> {
  const { data, error } = await seasonalClient
    .from('homework')
    .select('*')
    .eq('course_id', courseId)
    .is('lesson_id', null);
  return error ? [] : data ?? [];
}

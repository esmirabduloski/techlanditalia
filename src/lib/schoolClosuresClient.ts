import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { SchoolClosure } from '@/lib/schoolClosures';

// Reuse the authenticated client; do not change generated types for a pending migration.
type SchoolClosuresDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      school_closures: {
        Row: SchoolClosure;
        Insert: Pick<SchoolClosure, 'title' | 'start_date' | 'end_date'> & Partial<SchoolClosure>;
        Update: Partial<SchoolClosure>;
        Relationships: [];
      };
    };
  };
};

export const schoolClosuresClient = supabase as unknown as SupabaseClient<SchoolClosuresDatabase>;

/**
 * Chiusure che finiscono da `from` in poi (tutte senza `from`), per generare i
 * calendari dei gruppi. Se la lettura fallisce torna [] e il calendario si
 * genera comunque, come prima delle chiusure.
 */
export async function fetchClosures(from?: string): Promise<SchoolClosure[]> {
  let query = schoolClosuresClient.from('school_closures').select('*').order('start_date');
  if (from) query = query.gte('end_date', from.slice(0, 10));
  const { data, error } = await query;
  if (error) {
    console.warn('Chiusure non disponibili:', error.message);
    return [];
  }
  return data ?? [];
}

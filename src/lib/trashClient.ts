import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { TrashBatch } from '@/lib/trash';

type PublicSchema = Database['public'];

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0069_trash: tabella trash_items, vista trash_batches e funzioni di ripristino.
type TrashDatabase = Omit<Database, 'public'> & {
  public: Omit<PublicSchema, 'Tables' | 'Views' | 'Functions'> & {
    Tables: PublicSchema['Tables'] & {
      trash_items: {
        Row: {
          id: number;
          batch_id: string;
          table_name: string;
          row_data: Json;
          links: Json | null;
          deleted_by: string | null;
          deleted_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: PublicSchema['Views'] & {
      trash_batches: {
        Row: {
          batch_id: string;
          deleted_at: string;
          deleted_by: string | null;
          root_table: string;
          root_data: Json;
          counts: Json;
          total: number;
        };
        Relationships: [];
      };
    };
    Functions: PublicSchema['Functions'] & {
      restore_trash_batch: { Args: { _batch: string }; Returns: number };
      purge_trash_batch: { Args: { _batch: string }; Returns: number };
      empty_trash: { Args: Record<string, never>; Returns: number };
    };
  };
};

export const trashClient = supabase as unknown as SupabaseClient<TrashDatabase>;

/** Tabella, vista o funzione non ancora create: la migrazione 0069 non è applicata. */
export function isMissingTrashSchema(error: { code?: string } | null | undefined): boolean {
  return ['42P01', 'PGRST202', 'PGRST205'].includes(error?.code ?? '');
}

/** Batch dal più recente; null se la migrazione non è ancora applicata. */
export async function fetchTrashBatches(): Promise<TrashBatch[] | null> {
  const { data, error } = await trashClient
    .from('trash_batches')
    .select('*')
    .order('deleted_at', { ascending: false });
  if (error) {
    if (isMissingTrashSchema(error)) return null;
    throw error;
  }
  return (data ?? []).map((row) => ({
    ...row,
    root_data: (row.root_data ?? {}) as Record<string, unknown>,
    counts: (row.counts ?? {}) as Record<string, number>,
  }));
}

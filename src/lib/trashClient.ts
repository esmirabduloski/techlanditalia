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

interface PurgeAccountsResponse {
  ok?: boolean;
  error?: string;
  failed?: string[];
  fileErrors?: string[];
}

/**
 * Account eliminati per sempre (login e file nello storage) dalla edge function
 * purge-deleted-accounts (0076): purge_trash_batch ed empty_trash non li toccano.
 * Restituisce i file rimasti nello storage, che non bloccano l'eliminazione.
 */
export async function purgeAccountBatches(batchIds: string[]): Promise<{ fileErrors: string[] }> {
  if (batchIds.length === 0) return { fileErrors: [] };
  const { data, error } = await supabase.functions.invoke<PurgeAccountsResponse>('purge-deleted-accounts', {
    body: { batchIds },
  });
  if (!error && data?.ok) return { fileErrors: data.fileErrors ?? [] };

  // Con le risposte 4xx/5xx il corpo è in error.context
  let payload: PurgeAccountsResponse | null = data;
  if (error && typeof error === 'object' && 'context' in error) {
    payload = await ((error as { context: Response }).context).clone().json().catch(() => null);
  }
  const failed = payload?.failed?.length ?? 0;
  throw new Error(
    payload?.error ??
      (failed > 0
        ? `${failed === 1 ? 'Un account non è stato eliminato' : `${failed} account non sono stati eliminati`}: restano nel cestino, riprova tra poco.`
        : error instanceof Error ? error.message : 'Eliminazione non riuscita'),
  );
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

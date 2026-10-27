import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { SupabaseInstance } from '@/integrations/supabase/lazyClient';

type PublicSchema = Database['public'];

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0077_second_parent: genitori in più oltre a profiles.parent_id (student_guardians)
// e la funzione dell'admin che assegna i figli.
type FamilyDatabase = Omit<Database, 'public'> & {
  public: Omit<PublicSchema, 'Tables' | 'Functions'> & {
    Tables: PublicSchema['Tables'] & {
      student_guardians: {
        Row: { student_id: string; guardian_id: string; created_at: string };
        Insert: { student_id: string; guardian_id: string; created_at?: string };
        Update: { student_id?: string; guardian_id?: string; created_at?: string };
        Relationships: [];
      };
    };
    Functions: PublicSchema['Functions'] & {
      admin_set_parent_children: { Args: { _parent: string; _children: string[] }; Returns: undefined };
    };
  };
};

/**
 * Riceve il client invece di importarlo: useProfileRole gira su tutte le pagine
 * con il client lazy, che non deve finire nel grafo statico della home.
 */
const asFamily = (client: SupabaseInstance) => client as unknown as SupabaseClient<FamilyDatabase>;

export interface GuardianLink {
  student_id: string;
  guardian_id: string;
  created_at: string;
}

/** Tabella o funzione non ancora create: la migrazione 0077 non è applicata. */
export function isMissingFamilySchema(error: { code?: string } | null | undefined): boolean {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code ?? '');
}

/**
 * Figli di un genitore: quelli di cui è il genitore principale (profiles.parent_id)
 * e quelli di cui è secondo genitore. Senza la migrazione 0077 solo i primi. Come
 * le query che sostituisce, in caso di errore restituisce quello che ha trovato.
 */
export async function fetchChildIds(client: SupabaseInstance, parentId: string): Promise<string[]> {
  const [own, linked] = await Promise.all([
    client.from('profiles').select('id').eq('parent_id', parentId),
    asFamily(client).from('student_guardians').select('student_id').eq('guardian_id', parentId),
  ]);
  const ids = new Set((own.data ?? []).map((r) => r.id));
  for (const r of linked.data ?? []) ids.add(r.student_id);
  return [...ids];
}

/** Collegamenti da secondo genitore, tutti (admin) o solo di questi alunni. [] senza la migrazione 0077. */
export async function fetchGuardianLinks(client: SupabaseInstance, studentIds?: string[]): Promise<GuardianLink[]> {
  if (studentIds && studentIds.length === 0) return [];
  let query = asFamily(client).from('student_guardians').select('student_id, guardian_id, created_at');
  if (studentIds) query = query.in('student_id', studentIds);
  const { data, error } = await query.order('created_at');
  if (error && !isMissingFamilySchema(error)) console.warn('Secondi genitori non disponibili:', error.message);
  return data ?? [];
}

/**
 * Assegna figli (Admin → Utenti). childIds è l'elenco completo dopo il salvataggio:
 * chi non ha un genitore diventa figlio principale, chi ce l'ha già riceve questo
 * come secondo genitore. Senza la migrazione 0077 resta la edge function di prima,
 * che accetta solo alunni senza genitore.
 */
export async function saveParentChildren(client: SupabaseInstance, parentId: string, childIds: string[]): Promise<void> {
  const { error } = await asFamily(client).rpc('admin_set_parent_children', { _parent: parentId, _children: childIds });
  if (!error) return;
  if (!isMissingFamilySchema(error)) throw new Error(error.message);

  const { data, error: fnError } = await client.functions.invoke('admin-assign-children', {
    body: { parentId, childIds },
  });
  if (fnError || data?.error) throw new Error(data?.error || fnError?.message || 'Impossibile aggiornare i figli');
}

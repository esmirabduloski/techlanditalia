import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0085_student_extra_meeting_links: secondo link per entrare a lezione, per studente.

// type, non interface: supabase-js vuole righe assegnabili a Record<string, unknown>
export type ExtraMeetingLink = {
  student_id: string;
  label: string;
  url: string;
};

type ExtraLinksDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      student_extra_meeting_links: {
        Row: ExtraMeetingLink & { created_at: string; updated_at: string };
        Insert: ExtraMeetingLink;
        Update: Partial<ExtraMeetingLink>;
        Relationships: [];
      };
    };
  };
};

const client = supabase as unknown as SupabaseClient<ExtraLinksDatabase>;

export const EXTRA_LINK_LABEL_MAX = 80;

/** Tabella non ancora creata: la migrazione 0085 non è applicata. */
export function isMissingExtraLinksSchema(error: { code?: string } | null | undefined): boolean {
  return ['42P01', 'PGRST205'].includes(error?.code ?? '');
}

/** Controlli del modulo admin: null se va bene, altrimenti il messaggio. */
export function validateExtraLink(label: string, url: string): string | null {
  const l = label.trim();
  const u = url.trim();
  if (!u) return null; // link vuoto = togli il pulsante
  if (!l) return 'Scrivi il testo del pulsante (es. "LINK PER GRUPPO DEL MARTEDÌ").';
  if (l.length > EXTRA_LINK_LABEL_MAX) return `Il testo del pulsante può avere al massimo ${EXTRA_LINK_LABEL_MAX} caratteri.`;
  if (!/^https:\/\/\S+$/i.test(u)) return 'Il link deve iniziare con https:// e non avere spazi.';
  try {
    new URL(u);
  } catch {
    return 'Il link non è valido.';
  }
  return null;
}

/** Link degli studenti indicati (RLS: i propri, quelli dei figli, tutti per l'admin). */
export async function fetchExtraMeetingLinks(studentIds?: string[]): Promise<ExtraMeetingLink[]> {
  if (studentIds && studentIds.length === 0) return [];
  let query = client.from('student_extra_meeting_links').select('student_id, label, url');
  if (studentIds) query = query.in('student_id', studentIds);
  const { data, error } = await query;
  if (error) {
    if (!isMissingExtraLinksSchema(error)) console.warn('Secondo link non disponibile:', error.message);
    return [];
  }
  return data ?? [];
}

/** Salva il link dello studente; con il link vuoto lo toglie. Restituisce un messaggio d'errore o null. */
export async function saveExtraMeetingLink(studentId: string, label: string, url: string): Promise<string | null> {
  const invalid = validateExtraLink(label, url);
  if (invalid) return invalid;
  const { error } = url.trim()
    ? await client
        .from('student_extra_meeting_links')
        .upsert({ student_id: studentId, label: label.trim(), url: url.trim() }, { onConflict: 'student_id' })
    : await client.from('student_extra_meeting_links').delete().eq('student_id', studentId);
  if (error) {
    return isMissingExtraLinksSchema(error)
      ? 'Funzione non ancora attiva: manca l\'aggiornamento del database.'
      : error.message;
  }
  return null;
}

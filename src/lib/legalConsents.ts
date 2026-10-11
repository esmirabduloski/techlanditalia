import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

/**
 * Registro dei consensi a Privacy e Termini (migrazione 0023_legal_consent_records).
 * Per i figli accetta il genitore: una riga per figlio, documento e versione.
 * Le versioni in vigore stanno in legal_document_versions, non nel client.
 */
export type LegalDocument = 'privacy' | 'terms';

export const LEGAL_DOCUMENTS: Record<LegalDocument, { label: string; url: string }> = {
  privacy: { label: 'Informativa privacy', url: '/privacy' },
  terms: { label: 'Termini e condizioni', url: '/termini' },
};

export interface PendingConsent {
  /** null = il genitore per sé */
  subject_id: string | null;
  subject_name: string | null;
  document: LegalDocument;
  version: string;
  published_at: string;
}

export interface ConsentRecord {
  id: string;
  accepted_by: string;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  subject_id: string | null;
  subject_name: string | null;
  capacity: 'self' | 'parent_for_child';
  document: LegalDocument;
  version: string;
  accepted_at: string;
  ip: string | null;
  user_agent: string | null;
}

/** "11 ottobre 2026" */
export function formatVersionDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMMM yyyy', { locale: it });
}

/** Documenti da accettare (uno per tipo, all'ultima versione) e figli coinvolti. */
export function summarizePending(pending: PendingConsent[]) {
  const documents = new Map<LegalDocument, PendingConsent>();
  const children = new Map<string, string>();
  for (const p of pending) {
    if (!documents.has(p.document)) documents.set(p.document, p);
    if (p.subject_id) children.set(p.subject_id, p.subject_name ?? 'Figlio');
  }
  return {
    documents: [...documents.values()].sort((a, b) => a.document.localeCompare(b.document)),
    children: [...children].map(([id, name]) => ({ id, name })),
  };
}

export async function fetchPendingConsents(): Promise<PendingConsent[]> {
  const { data, error } = await supabase.rpc('pending_legal_consents' as never);
  if (error) throw error;
  return (data ?? []) as PendingConsent[];
}

/** Registra esattamente le voci mostrate: il server rifiuta se nel frattempo sono cambiate. */
export async function recordConsents(pending: PendingConsent[]): Promise<number> {
  const items = pending.map(({ subject_id, document, version }) => ({ subject_id, document, version }));
  const { data, error } = await supabase.rpc('record_legal_consents' as never, { _items: items } as never);
  if (error) throw error;
  return data as number;
}

export async function fetchConsentRecords(limit = 1000): Promise<ConsentRecord[]> {
  const { data, error } = await supabase
    .from('consent_records' as never)
    .select('*')
    .order('accepted_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ConsentRecord[];
}

const csvCell = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;

export function consentRecordsToCsv(records: ConsentRecord[]): string {
  const header = ['Data e ora', 'Genitore', 'Email genitore', 'Per conto di', 'Documento', 'Versione', 'IP', 'Browser', 'ID genitore', 'ID figlio'];
  const rows = records.map((r) => [
    format(parseISO(r.accepted_at), 'yyyy-MM-dd HH:mm:ss'),
    r.accepted_by_name,
    r.accepted_by_email,
    r.capacity === 'self' ? 'sé stesso' : r.subject_name,
    LEGAL_DOCUMENTS[r.document]?.label ?? r.document,
    r.version,
    r.ip,
    r.user_agent,
    r.accepted_by,
    r.subject_id,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

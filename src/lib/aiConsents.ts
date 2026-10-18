import { supabase } from '@/integrations/supabase/client';
import { formatConsentDate } from '@/lib/mediaConsents';

/**
 * Consenso agli strumenti AI per gli studenti (L. 132/2025, art. 4 c. 4;
 * migrazione 0054_ai_parental_consent). Sotto i 14 anni decide il genitore,
 * dai 14 anche lo studente per sé. Le tabelle non sono ancora nei tipi generati:
 * il contratto sta qui, come per i consensi foto e video.
 *
 * Finché non c'è una versione in ai_consent_versions non si vede nulla. Per
 * lanciare il primo strumento AI:
 *   1. migrazione che inserisce la versione in ai_consent_versions;
 *   2. descrivere lo strumento in AI_TOOLS (cosa fa, quali dati, a chi);
 *   3. sezione sugli strumenti AI in /privacy (Privacy.tsx), in parole semplici
 *      e con l'anno di nascita tra i dati, e nuova versione privacy in
 *      legal_document_versions;
 *   4. <AiToolGate> intorno allo strumento e requireAiConsent()
 *      (supabase/functions/_shared/aiconsent.ts) nella sua edge function.
 * Uno strumento nuovo che cambia dati o fornitore vuole una nuova versione: il
 * consenso dato sulla vecchia non vale più e va chiesto di nuovo.
 */
export interface AiTool {
  id: string;
  label: string;
  /** Cosa fa, detto a un genitore */
  description: string;
  /** Quali dati dello studente gli arrivano */
  dataSent: string;
  /** A chi vanno i dati (fornitore del modello) */
  provider: string;
}

export const AI_TOOLS: AiTool[] = [];

/** Dai 14 anni lo studente può dare il consenso da solo (art. 4 c. 4) */
export const AI_SELF_CONSENT_AGE = 14;

export type AiDecidedAs = 'parent' | 'student' | 'admin';
export type AiConsentStatus = 'none' | 'granted' | 'revoked' | 'outdated';

export interface AiConsent {
  student_id: string;
  granted: boolean;
  version: string;
  decided_by: string | null;
  decided_as: AiDecidedAs;
  decided_at: string;
}

export interface AiAccess {
  /** null = nessuno strumento AI */
  version: string | null;
  /** adult = genitore, insegnante o admin: non serve il consenso */
  status: AiConsentStatus | 'no_tools' | 'adult';
  allowed: boolean;
  can_self_consent: boolean;
}

/**
 * Stessa regola di ai_self_consent_age() nel database, che resta quella che
 * conta: con il solo anno di nascita i 14 anni sono certi solo dall'anno dopo
 * il compleanno. Senza anno decide il genitore.
 */
export function canSelfConsent(birthYear: number | null | undefined, today = new Date()): boolean {
  if (!birthYear) return false;
  return today.getFullYear() - birthYear > AI_SELF_CONSENT_AGE;
}

/** Anni accettati da set_student_birth_year: dai 4 ai 19 anni, dal più recente */
export function birthYearOptions(today = new Date()): number[] {
  const year = today.getFullYear();
  return Array.from({ length: 16 }, (_, i) => year - 4 - i);
}

export function aiConsentStatus(consent: AiConsent | undefined, version: string | null): AiConsentStatus {
  if (!consent) return 'none';
  if (!consent.granted) return 'revoked';
  return consent.version === version ? 'granted' : 'outdated';
}

/** "Attivato da te il 18/10/2026", "Disattivato da Marco il …" */
export function aiDecisionText(
  consent: AiConsent | undefined,
  version: string | null,
  viewer: { id: string; studentName: string | null },
): string {
  const status = aiConsentStatus(consent, version);
  if (!consent || status === 'none') return 'Non attivo';
  if (status === 'outdated') return 'Da rinnovare: gli strumenti AI sono cambiati';
  const who =
    consent.decided_as === 'student'
      ? `da ${viewer.studentName?.split(' ')[0] ?? 'tuo figlio'}`
      : consent.decided_as === 'admin'
        ? 'dalla segreteria Techland'
        : consent.decided_by === viewer.id
          ? 'da te'
          : 'da un genitore';
  return `${status === 'granted' ? 'Attivato' : 'Disattivato'} ${who} il ${formatConsentDate(consent.decided_at)}`;
}

export async function fetchAiConsentVersion(): Promise<string | null> {
  const { data, error } = await supabase.rpc('current_ai_consent_version' as never);
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function fetchAiConsents(studentIds?: string[]): Promise<Map<string, AiConsent>> {
  let query = supabase
    .from('ai_consents' as never)
    .select('student_id, granted, version, decided_by, decided_as, decided_at');
  if (studentIds) query = query.in('student_id', studentIds);
  const { data, error } = await query;
  const map = new Map<string, AiConsent>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as AiConsent[]) map.set(row.student_id, row);
  return map;
}

export async function fetchBirthYears(studentIds?: string[]): Promise<Map<string, number>> {
  let query = supabase.from('student_birth_years' as never).select('student_id, birth_year');
  if (studentIds) query = query.in('student_id', studentIds);
  const { data, error } = await query;
  const map = new Map<string, number>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as { student_id: string; birth_year: number }[]) map.set(row.student_id, row.birth_year);
  return map;
}

export interface AiConsentEvent {
  id: string;
  student_id: string;
  granted: boolean;
  decided_as: AiDecidedAs;
  decided_at: string;
}

export async function fetchAiConsentEvents(limit = 30): Promise<AiConsentEvent[]> {
  const { data, error } = await supabase
    .from('ai_consent_events' as never)
    .select('id, student_id, granted, decided_as, decided_at')
    .order('decided_at', { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data as AiConsentEvent[];
}

/** version = versione dell'informativa mostrata: il server rifiuta se nel frattempo è cambiata */
export async function setAiConsent(studentId: string, granted: boolean, version: string | null) {
  return supabase.rpc('set_ai_consent' as never, { _student: studentId, _granted: granted, _version: version } as never);
}

export async function setBirthYear(studentId: string, year: number) {
  return supabase.rpc('set_student_birth_year' as never, { _student: studentId, _year: year } as never);
}

/** Gli errori dei nostri controlli (22023) sono già frasi per l'utente; gli altri no */
export function aiErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '22023' && e.message) return e.message;
  return 'Riprova o scrivici a info@techlanditalia.it';
}

export interface ChildAiState {
  id: string;
  full_name: string | null;
  birthYear: number | null;
  consent: AiConsent | undefined;
}

/** Per il genitore. null = non genitore, nessun figlio o ancora nessuno strumento AI. */
export async function fetchChildrenAiState(parentId: string): Promise<{ version: string; children: ChildAiState[] } | null> {
  const [{ data: me }, version] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', parentId).maybeSingle(),
    fetchAiConsentVersion(),
  ]);
  if (me?.role !== 'parent' || !version) return null;
  const { data: kids } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('parent_id', parentId)
    .eq('role', 'student');
  const list = kids ?? [];
  if (list.length === 0) return null;
  const ids = list.map((k) => k.id);
  const [consents, years] = await Promise.all([fetchAiConsents(ids), fetchBirthYears(ids)]);
  return {
    version,
    children: list.map((k) => ({
      id: k.id,
      full_name: k.full_name,
      birthYear: years.get(k.id) ?? null,
      consent: consents.get(k.id),
    })),
  };
}

export async function fetchMyAiAccess(): Promise<AiAccess | null> {
  const { data, error } = await supabase.rpc('my_ai_access' as never);
  if (error || !data) return null;
  return data as AiAccess;
}

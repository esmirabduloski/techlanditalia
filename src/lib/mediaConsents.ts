import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Consensi separati per foto e video dei minori: uno per finalità, dato dal
 * genitore e revocabile in qualsiasi momento. Nessuna riga = non concesso.
 */
export type MediaPurpose = 'lesson_recording' | 'open_day' | 'social';

export const MEDIA_PURPOSES: { id: MediaPurpose; label: string; description: string }[] = [
  {
    id: 'lesson_recording',
    label: 'Registrazione delle lezioni',
    description: 'Video, voce e schermo condiviso di tuo figlio nelle registrazioni delle lezioni online.',
  },
  {
    id: 'open_day',
    label: 'Giornate di presentazione',
    description: 'Foto e video scattati durante open day, saggi ed eventi di presentazione dei corsi.',
  },
  {
    id: 'social',
    label: 'Sito e social',
    description: 'Pubblicazione di foto o video in cui tuo figlio è riconoscibile sul sito Techland e sui nostri canali social.',
  },
];

export interface MediaConsent {
  student_id: string;
  purpose: MediaPurpose;
  granted: boolean;
  decided_at: string;
}

export type MediaConsentStatus = 'granted' | 'revoked' | 'none';

export function consentKey(studentId: string, purpose: MediaPurpose): string {
  return `${studentId}:${purpose}`;
}

export function consentStatus(consent: MediaConsent | undefined): MediaConsentStatus {
  if (!consent) return 'none';
  return consent.granted ? 'granted' : 'revoked';
}

/** Divide gli studenti tra chi può comparire per una finalità e chi no. */
export function splitByConsent<T extends { id: string }>(
  students: T[],
  consents: Map<string, MediaConsent>,
  purpose: MediaPurpose,
): { allowed: T[]; blocked: T[] } {
  const allowed: T[] = [];
  const blocked: T[] = [];
  for (const s of students) {
    (consentStatus(consents.get(consentKey(s.id, purpose))) === 'granted' ? allowed : blocked).push(s);
  }
  return { allowed, blocked };
}

export function formatConsentDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}

export async function fetchMediaConsents(studentIds?: string[]): Promise<Map<string, MediaConsent>> {
  let query = supabase.from('media_consents' as never).select('student_id, purpose, granted, decided_at');
  if (studentIds) query = query.in('student_id', studentIds);
  const { data, error } = await query;
  const map = new Map<string, MediaConsent>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as MediaConsent[]) map.set(consentKey(row.student_id, row.purpose), row);
  return map;
}

export async function setMediaConsent(studentId: string, purpose: MediaPurpose, granted: boolean) {
  return supabase
    .from('media_consents' as never)
    .upsert({ student_id: studentId, purpose, granted } as never, { onConflict: 'student_id,purpose' });
}

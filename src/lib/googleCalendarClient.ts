import { supabase } from '@/integrations/supabase/client';

/**
 * Collegamento diretto a Google Calendar (edge function google-calendar,
 * migrazione 0068). Finché i segreti Google non sono impostati, o la funzione
 * non è pubblicata, `configured` è false e la dashboard offre solo il link .ics.
 */

export type GoogleConnectionStatus = 'active' | 'revoked' | 'calendar_missing';

export interface GoogleConnection {
  google_email: string | null;
  status: GoogleConnectionStatus;
  /** Ultimo errore, già in italiano */
  last_error: string | null;
  last_synced_at: string | null;
  /** Ci sono modifiche non ancora arrivate su Google */
  pending: boolean;
  connected_at: string;
}

export interface GoogleCalendarState {
  configured: boolean;
  connection: GoogleConnection | null;
}

export type SyncOutcome =
  | { ok: true; stats: { inserted: number; updated: number; removed: number; unchanged: number } }
  | { ok: false; status: string; error: string };

export type GoogleCall<T> = { ok: true; data: T } | { ok: false; error: string; reason?: string };

const UNREACHABLE = 'Google Calendar non raggiungibile, riprova tra poco';

async function call<T>(body: Record<string, string>): Promise<GoogleCall<T>> {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (error) {
    // Con risposte 4xx/5xx supabase-js mette il corpo in error.context, non in data
    let payload: { error?: string; reason?: string } | undefined;
    if ('context' in error) {
      try {
        payload = await (error.context as Response).clone().json();
      } catch {
        // corpo non leggibile
      }
    }
    return { ok: false, error: payload?.error || UNREACHABLE, reason: payload?.reason };
  }
  if (data?.error) return { ok: false, error: data.error, reason: data.reason };
  return { ok: true, data: data as T };
}

export async function fetchGoogleCalendarState(): Promise<GoogleCalendarState> {
  const r = await call<GoogleCalendarState>({ action: 'status' });
  if (!r.ok || r.data?.configured !== true) return { configured: false, connection: null };
  return { configured: true, connection: r.data.connection ?? null };
}

export const startGoogleConnect = () => call<{ url: string }>({ action: 'start' });

export const finishGoogleConnect = (code: string, state: string) =>
  call<{ connection: GoogleConnection | null; sync: SyncOutcome }>({ action: 'finish', code, state });

export const syncGoogleNow = () =>
  call<{ ok: boolean; connection: GoogleConnection | null; sync: SyncOutcome }>({ action: 'sync' });

export const disconnectGoogle = () => call<{ ok: true }>({ action: 'disconnect' });

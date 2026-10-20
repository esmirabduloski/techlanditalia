/**
 * Sincronizzazione del calendario Google di un insegnante collegato
 * (google_calendar_connections, migrazione 0068). La usano google-calendar
 * (subito dopo il collegamento e con "Aggiorna ora") e google-calendar-sync
 * (dal cron, per le connessioni segnate dai trigger su lezioni e gruppi).
 *
 * Esiti salvati sulla connessione:
 *   - ok: last_synced_at; dirty_at si azzera solo se nessuno l'ha cambiato
 *     nel frattempo (altrimenti al giro dopo si risincronizza);
 *   - accesso revocato da Google o calendario eliminato: la connessione si
 *     ferma (status) finché l'insegnante non ricollega;
 *   - altri errori (Google irraggiungibile, limiti): si riprova tra 10 minuti.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calendarApi,
  type Fetch,
  type GoogleConfig,
  isCalendarMissing,
  isRevoked,
  refreshAccessToken,
  syncCalendar,
  type SyncStats,
} from "./googlecalendar.ts";
import { feedWindow, lessonEvents } from "./teachercalendar.ts";
import { isTeacher, loadTeacherLessons } from "./teacherlessons.ts";

export const RETRY_MINUTES = 10;

export interface Connection {
  teacher_id: string;
  refresh_token: string;
  calendar_id: string | null;
  dirty_at: string | null;
}

export type SyncOutcome =
  | { ok: true; stats: SyncStats }
  | { ok: false; status: "revoked" | "calendar_missing" | "error"; error: string };

export const REVOKED_MESSAGE = "Google ha tolto l'accesso a TECHLAND: collega di nuovo il tuo account.";
export const CALENDAR_MISSING_MESSAGE = "Il calendario «TECHLAND · Lezioni» è stato eliminato da Google: collega di nuovo il tuo account.";

export async function syncConnection(
  supabase: SupabaseClient,
  cfg: GoogleConfig,
  conn: Connection,
  opts: { siteUrl: string; now?: Date; fetchFn?: Fetch },
): Promise<SyncOutcome> {
  const now = opts.now ?? new Date();
  const table = () => supabase.from("google_calendar_connections");

  try {
    if (!conn.calendar_id) throw new Error("Connessione senza calendario");
    const accessToken = await refreshAccessToken(cfg, conn.refresh_token, opts.fetchFn);
    const { groups, lessons } = (await isTeacher(supabase, conn.teacher_id))
      ? await loadTeacherLessons(supabase, conn.teacher_id, now)
      : { groups: [], lessons: [] };
    const stats = await syncCalendar(
      calendarApi(accessToken, opts.fetchFn),
      conn.calendar_id,
      lessonEvents(groups, lessons, opts.siteUrl),
      `${feedWindow(now).from}T00:00:00Z`,
    );

    const { error } = await table()
      .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null, retry_after: null })
      .eq("teacher_id", conn.teacher_id);
    if (error) throw error;
    // Una modifica arrivata durante la sincronizzazione ha cambiato dirty_at: resta da fare
    const clear = table().update({ dirty_at: null }).eq("teacher_id", conn.teacher_id);
    const { error: clearError } = conn.dirty_at ? await clear.eq("dirty_at", conn.dirty_at) : await clear.is("dirty_at", null);
    if (clearError) throw clearError;
    return { ok: true, stats };
  } catch (e) {
    const outcome: SyncOutcome = isRevoked(e)
      ? { ok: false, status: "revoked", error: REVOKED_MESSAGE }
      : isCalendarMissing(e)
      ? { ok: false, status: "calendar_missing", error: CALENDAR_MISSING_MESSAGE }
      : { ok: false, status: "error", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) };

    await table()
      .update(
        outcome.status === "error"
          ? { last_error: outcome.error, retry_after: new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString() }
          : { status: outcome.status, last_error: outcome.error, retry_after: null },
      )
      .eq("teacher_id", conn.teacher_id);
    return outcome;
  }
}

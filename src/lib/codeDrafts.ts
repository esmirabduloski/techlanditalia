/**
 * Dove salvare la bozza di codice di uno studente (tabella student_code_drafts).
 *
 * I compilatori ricevono una sola chiave `taskId`:
 * - "<uuid>"           task di una lezione  -> colonna task_id
 * - "homework-<uuid>"  compito              -> colonna homework_id
 */
export interface DraftTarget {
  column: "task_id" | "homework_id";
  id: string;
}

const HOMEWORK_PREFIX = "homework-";

export function draftTarget(key: string): DraftTarget {
  return key.startsWith(HOMEWORK_PREFIX)
    ? { column: "homework_id", id: key.slice(HOMEWORK_PREFIX.length) }
    : { column: "task_id", id: key };
}

/** Colonna di riferimento da mettere nel record (tipizzata per il client Supabase). */
export function draftColumns(target: DraftTarget): { task_id?: string; homework_id?: string } {
  return target.column === "homework_id" ? { homework_id: target.id } : { task_id: target.id };
}

/** Valore di `onConflict` per l'upsert: corrisponde ai vincoli unici della tabella. */
export function draftConflictTarget(target: DraftTarget): string {
  return `student_id,${target.column},code_type`;
}

/**
 * Salvataggi in sospeso dei compilatori aperti. Chi legge le bozze dal database
 * (es. il pulsante INVIA dei compiti) chiama prima `flushCodeDrafts()`, così
 * include anche le modifiche non ancora salvate dall'autosave.
 */
const flushers = new Set<() => Promise<void>>();

export function registerDraftFlusher(flush: () => Promise<void>): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

export async function flushCodeDrafts(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

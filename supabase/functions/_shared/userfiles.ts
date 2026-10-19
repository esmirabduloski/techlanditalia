/**
 * File di un utente nello storage, da cancellare insieme all'account
 * (diritto all'oblio, art. 17 GDPR). Senza questo passaggio l'eliminazione
 * dell'account toglie le righe del database ma lascia i file.
 *
 * Bucket con una cartella per utente ("<id utente>/..."):
 *   homework-files       file consegnati con i compiti
 *   student-web-assets   immagini/CSS/JS caricati nel compilatore web (migrazione 0055)
 *   web-compiler-assets  gli stessi file caricati prima della 0055, non ancora spostati
 * group-certificates è organizzato per gruppo, non per utente: non si tocca.
 *
 * Usato da delete-my-account e da admin-set-password (action "delete") con il
 * client service role, prima di eliminare l'utente.
 */

export const USER_FILE_BUCKETS = ["homework-files", "student-web-assets", "web-compiler-assets"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000;
const REMOVE_BATCH = 100;

// Solo le parti del client Supabase usate qui (così i test usano un finto client)
interface Listed {
  name: string;
  id: string | null;
}
interface BucketApi {
  list(prefix?: string, options?: { limit?: number; offset?: number }): Promise<{ data: Listed[] | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
}
export interface StorageLike {
  from(bucket: string): BucketApi;
}

export interface RemoveUserFilesResult {
  removed: number;
  /** "<bucket>: <errore>" per ogni bucket in cui qualcosa non è andato */
  errors: string[];
}

/** Tutti i file sotto una cartella, sottocartelle comprese. */
async function listFiles(bucket: BucketApi, folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(folder, { limit: PAGE, offset });
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      const path = `${folder}/${item.name}`;
      // Le cartelle tornano con id null
      if (item.id === null) paths.push(...(await listFiles(bucket, path)));
      else paths.push(path);
    }
    if (!data || data.length < PAGE) return paths;
  }
}

/**
 * Cancella la cartella dell'utente in tutti i bucket. Non si ferma al primo
 * errore: prova tutti i bucket e restituisce cosa non è riuscito, così chi
 * chiama decide (l'account si elimina comunque, gli admin vengono avvisati).
 */
export async function removeUserFiles(storage: StorageLike, userId: string): Promise<RemoveUserFilesResult> {
  // Un id vuoto o strano vorrebbe dire elencare la radice del bucket: mai
  if (!UUID.test(userId)) throw new Error(`id utente non valido: ${userId}`);

  let removed = 0;
  const errors: string[] = [];
  for (const name of USER_FILE_BUCKETS) {
    const bucket = storage.from(name);
    try {
      const paths = await listFiles(bucket, userId);
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const batch = paths.slice(i, i + REMOVE_BATCH);
        const { error } = await bucket.remove(batch);
        if (error) throw new Error(error.message);
        removed += batch.length;
      }
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { removed, errors };
}

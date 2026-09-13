/**
 * Accesso "lazy" al client Supabase per il codice che gira su TUTTE le pagine
 * (provider in App.tsx: auth, analytics).
 *
 * Un `import { supabase } from './client'` statico in quei moduli mette
 * @supabase/supabase-js (~54 KB gzip: GoTrue, PostgREST, Realtime, Storage) nel
 * grafo iniziale di ogni pagina pubblica prerenderata, da scaricare ed eseguire
 * prima che l'hydration finisca. Con l'import dinamico il chunk arriva dopo il
 * primo paint; le pagine private lo importano comunque staticamente nel proprio
 * chunk, quindi per loro non cambia nulla.
 *
 * Il tipo è quello esatto del client generato (typeof import) : nessuna
 * dipendenza a runtime.
 */
export type SupabaseInstance = (typeof import('./client'))['supabase'];

let clientPromise: Promise<SupabaseInstance> | null = null;

export function getSupabase(): Promise<SupabaseInstance> {
  if (!clientPromise) {
    clientPromise = import('./client').then((m) => m.supabase);
  }
  return clientPromise;
}

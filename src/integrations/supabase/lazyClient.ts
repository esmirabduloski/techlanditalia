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

/**
 * Sulle pagine pubbliche prerenderate il primo import aspetta il `load` e un
 * momento di idle: così i ~55 KB di supabase-js non contendono banda e CPU a
 * CSS, font e hydration del primo schermo (e Lighthouse non li conta nell'LCP).
 * Sulle route private main.tsx ha già rimosso data-server-rendered: import subito.
 */
function whenSafeToLoad(): Promise<void> {
  if (typeof document === 'undefined' || !document.querySelector('[data-server-rendered]')) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const idle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout: 1000 });
      } else {
        setTimeout(resolve, 300);
      }
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
}

export function getSupabase(): Promise<SupabaseInstance> {
  if (!clientPromise) {
    clientPromise = whenSafeToLoad()
      .then(() => import('./client'))
      .then((m) => m.supabase);
  }
  return clientPromise;
}

/**
 * Punto unico di accesso a Sentry, con import NOMINALI.
 *
 * Va caricato solo con `import("@/lib/sentry")`: in questo modo Rollup può fare
 * tree-shaking del pacchetto. Un `await import("@sentry/react")` diretto
 * restituisce l'intero namespace e trascina nel bundle anche Replay, Feedback,
 * Replay-canvas e Profiling (~100 KB gzip inutilizzati, misurati da Lighthouse).
 *
 * Session Replay è stato rimosso di proposito: da solo pesa ~40 KB gzip e
 * costa due long task sui telefoni; per la diagnosi bastano errori + tracing.
 */
import { init, browserTracingIntegration, captureException, setUser } from '@sentry/react';
import { getSupabase } from '@/integrations/supabase/lazyClient';

export function initSentry(): void {
  init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Solo la build pubblicata invia eventi: gli errori di `npm run dev`
    // (hot reload su localhost) finivano tra quelli di produzione.
    enabled: import.meta.env.PROD,
    environment: import.meta.env.MODE,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.2,
    // Non propagare header di tracing verso servizi esterni.
    tracePropagationTargets: [/^\//],
  });
  if (import.meta.env.PROD) void trackUser();
}

/**
 * Collega gli errori all'account (solo l'id opaco, niente email o nome) così
 * Sentry conta gli utenti colpiti. INITIAL_SESSION arriva subito alla sottoscrizione.
 */
async function trackUser(): Promise<void> {
  try {
    const supabase = await getSupabase();
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
    });
  } catch {
    // Senza client Supabase gli errori arrivano comunque, solo senza utente.
  }
}

export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  captureException(error, extra ? { extra } : undefined);
}

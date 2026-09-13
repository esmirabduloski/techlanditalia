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
import { init, browserTracingIntegration, captureException } from '@sentry/react';

export function initSentry(): void {
  init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.2,
    // Non propagare header di tracing verso servizi esterni.
    tracePropagationTargets: [/^\//],
  });
}

export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  captureException(error, extra ? { extra } : undefined);
}

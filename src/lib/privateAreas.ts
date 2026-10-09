/**
 * Aree private del sito: studenti minorenni, genitori, insegnanti, admin e login.
 *
 * Qui non deve girare nessuno strumento di analisi o pubblicità (Clarity,
 * Google Analytics, Google Ads): i termini di Clarity e le regole di Google sulla
 * pubblicità personalizzata escludono i minori, e queste pagine contengono dati
 * personali. Lista unica usata da clarity.ts, googleAnalytics.ts e ScrollToTop
 * (index.html ne ha una copia nello snippet inline di Clarity).
 *
 * NB: non è la lista del prerender (prerender.ts): lì ci sono anche le landing
 * /lp, che sono pagine pubbliche delle campagne e vanno misurate.
 */
export const PRIVATE_AREA_PREFIXES = [
  "/admin",
  "/area-riservata",
  "/insegnante",
  "/auth",
  "/.lovable",
] as const;

export function isPrivateAreaPath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return PRIVATE_AREA_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

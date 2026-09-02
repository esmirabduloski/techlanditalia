/**
 * Prefissi di route ESCLUSI dal prerendering (SSG).
 *
 * Fonte unica di verità: importato sia da `vite.config.ts` (per filtrare le route
 * generate da vite-react-ssg) sia da `src/main.tsx` (per evitare l'hydration
 * contro l'HTML della home servito dal fallback SPA su queste route).
 *
 * NB: nessun import di codice applicativo qui — il file viene caricato anche
 * dalla config Vite in Node.
 */
export const NO_PRERENDER_PREFIXES = [
  "/admin",
  "/area-riservata",
  "/insegnante",
  "/auth",
  "/lp",
  "/.lovable",
] as const;

export function isNonPrerenderedPath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return NO_PRERENDER_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

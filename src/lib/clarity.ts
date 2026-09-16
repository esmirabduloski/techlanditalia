/**
 * Microsoft Clarity (mappe di calore e registrazioni di sessione).
 *
 * Gira SOLO sulle pagine pubbliche di marketing. Le aree riservate (studenti
 * minorenni, genitori, insegnanti, admin) e il login non vengono mai registrate:
 * i termini di Clarity vietano l'uso su prodotti rivolti a minori di 18 anni e
 * quelle pagine contengono dati personali.
 *
 * Il tag è caricato da index.html con la stessa guardia (regex duplicata lì
 * perché lo script inline non può importare moduli); ClarityGuard.tsx gestisce
 * la navigazione SPA (stop entrando in un'area riservata, start tornando fuori).
 *
 * Consent Mode: al caricamento inviamo consenso negato (consentv2), quindi
 * Clarity non imposta cookie e non collega visite diverse. Se in futuro si
 * aggiunge un banner, chiamare window.clarity('consentv2', {... 'granted'}).
 */
export const CLARITY_PROJECT_ID = "wk0bgige7s";

export const CLARITY_EXCLUDED_PREFIXES = [
  "/admin",
  "/area-riservata",
  "/insegnante",
  "/auth",
  "/.lovable",
] as const;

export function isClarityAllowedPath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return !CLARITY_EXCLUDED_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/** Inietta il tag a runtime (stesso codice dello snippet in index.html). */
export function loadClarityTag(): void {
  if (typeof window === "undefined" || window.clarity) return;
  const w = window as Window & { clarity?: { (...args: unknown[]): void; q?: unknown[] } };
  w.clarity = function (...args: unknown[]) {
    (w.clarity!.q = w.clarity!.q || []).push(args);
  };
  w.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(s);
}

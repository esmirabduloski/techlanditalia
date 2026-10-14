export const OBJECTIVE_PREFIX = 'Oggi imparerai a';
export const OBJECTIVE_MAX_LENGTH = 140;

/** Toglie un eventuale prefisso "Oggi imparerai a" scritto a mano e il punto finale. */
export function cleanObjective(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/^🎯\s*/u, '')
    .replace(/^oggi\s+imparerai\s+(a|ad)\s+/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
}

/** "Oggi imparerai a creare un bot." — come lo legge il ragazzo. */
export function formatObjective(text: string | null | undefined): string {
  const body = cleanObjective(text);
  return body ? `${OBJECTIVE_PREFIX} ${body}.` : '';
}

/** Versione per il genitore, in terza persona. */
export function formatObjectiveForParent(text: string | null | undefined, isPast: boolean): string {
  const body = cleanObjective(text);
  if (!body) return '';
  return `${isPast ? 'Ha imparato a' : 'Imparerà a'} ${body}.`;
}

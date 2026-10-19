/** Replit esegue il file indicato nell'intestazione: "#pgzero" diventa "#pgzero main.py" (se non lo è già). */
export function toReplitMain(code: string): string {
  return code.replace(/^(#\s*pgzero)(?!\s+main\.py)/im, '#pgzero main.py');
}

export const DEFAULT_REPLIT_URL = 'https://replit.com/@esmir1475/Pygame';

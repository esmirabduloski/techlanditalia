/**
 * Escape di una cella CSV con neutralizzazione delle formule (CSV injection):
 * i valori che iniziano con = + - @ tab o CR vengono prefissati con un apice.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Import in blocco degli studenti (admin-import-students): regole condivise con
 * src/lib/studentsCsv.ts, che prepara le righe e mostra l'anteprima.
 */

/** Righe per chiamata: il client raggruppa i fratelli nella stessa. */
export const STUDENT_IMPORT_BATCH_MAX = 20;

const MAX_NAME_LENGTH = 120;
const MAX_COURSES = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Come il dialog "Crea utente": minuscole, spazi in _, solo lettere, numeri e _. */
export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export interface StudentImportRow {
  /** Riga del foglio, per abbinare l'esito in anteprima */
  line: number;
  parentEmail: string;
  parentName: string;
  studentName: string;
  username: string;
  courseIds: string[];
}

export type RowCheck = { ok: true; row: StudentImportRow } | { ok: false; line: number; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Controlla una riga arrivata dal client e la normalizza. */
export function checkImportRow(raw: unknown): RowCheck {
  const r = (raw ?? {}) as Record<string, unknown>;
  const line = typeof r.line === "number" && Number.isInteger(r.line) ? r.line : 0;
  const fail = (error: string): RowCheck => ({ ok: false, line, error });

  const parentEmail = text(r.parentEmail).toLowerCase();
  const parentName = text(r.parentName);
  const studentName = text(r.studentName);
  const username = sanitizeUsername(text(r.username));
  const courseIds = Array.isArray(r.courseIds) ? r.courseIds : [];

  if (!EMAIL_RE.test(parentEmail)) return fail("Email del genitore non valida");
  if (!parentName || parentName.length > MAX_NAME_LENGTH) return fail("Nome del genitore mancante o troppo lungo");
  if (!studentName || studentName.length > MAX_NAME_LENGTH) return fail("Nome dello studente mancante o troppo lungo");
  if (!username) return fail("Username non valido");
  if (username !== text(r.username)) return fail(`Username non normalizzato (atteso "${username}")`);
  if (courseIds.length > MAX_COURSES || !courseIds.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return fail("Corsi non validi");
  }
  return { ok: true, row: { line, parentEmail, parentName, studentName, username, courseIds: [...new Set(courseIds as string[])] } };
}

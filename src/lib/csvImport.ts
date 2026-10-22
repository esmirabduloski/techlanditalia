import { uncsvCell } from '@/lib/csv';

/**
 * Import CSV in blocco (studenti, gruppi, lezioni): lettura delle colonne,
 * piano riga per riga mostrato in anteprima e parser delle celle.
 *
 * Regola comune: una colonna assente dal file non tocca quel campo, una cella
 * vuota lo svuota. Le righe non vengono mai cancellate.
 */

export interface CsvColumn<K extends string = string> {
  key: K;
  /** Intestazione scritta nell'export e nel modello */
  header: string;
  /** Altri nomi accettati all'import */
  aliases?: readonly string[];
  /** Senza questa colonna il file non si importa */
  required?: boolean;
  /** Esportata per comodità, ignorata all'import */
  readOnly?: boolean;
  /** Spiegazione mostrata nel dialog di import */
  hint?: string;
}

export interface CsvRecord<K extends string> {
  /** Riga del foglio (1 = intestazione) */
  line: number;
  /** Solo le colonne presenti nel file, già senza spazi ai bordi */
  values: Partial<Record<K, string>>;
}

export interface CsvTable<K extends string> {
  records: CsvRecord<K>[];
  present: Set<K>;
  /** Intestazioni delle colonne obbligatorie che mancano */
  missing: string[];
  /** Intestazioni non riconosciute */
  unknown: string[];
  /** Colonne in sola lettura trovate nel file */
  ignored: string[];
}

/** Minuscole, senza accenti e con un solo spazio: per confrontare nomi e intestazioni. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .trim();
}

export function readTable<K extends string>(rows: string[][], columns: readonly CsvColumn<K>[]): CsvTable<K> {
  const [header = [], ...body] = rows;
  const byName = new Map<string, CsvColumn<K>>();
  for (const c of columns) {
    for (const name of [c.header, ...(c.aliases ?? [])]) byName.set(normalizeKey(name), c);
  }

  const present = new Set<K>();
  const index = new Map<K, number>();
  const unknown: string[] = [];
  const ignored: string[] = [];
  header.forEach((raw, i) => {
    const name = uncsvCell(raw).trim();
    if (!name) return;
    const col = byName.get(normalizeKey(name));
    if (!col || present.has(col.key) || ignored.includes(col.header)) {
      unknown.push(name);
    } else if (col.readOnly) {
      ignored.push(col.header);
    } else {
      present.add(col.key);
      index.set(col.key, i);
    }
  });

  const missing = columns.filter((c) => c.required && !present.has(c.key)).map((c) => c.header);

  const records: CsvRecord<K>[] = [];
  body.forEach((cells, i) => {
    if (cells.every((c) => c.trim() === '')) return; // righe vuote in fondo ai fogli Excel
    const values: Partial<Record<K, string>> = {};
    for (const [key, at] of index) values[key] = uncsvCell(cells[at] ?? '').trim();
    records.push({ line: i + 2, values });
  });

  return { records, present, missing, unknown, ignored };
}

// --- Piano di import ---------------------------------------------------------

export type RowStatus = 'new' | 'update' | 'same' | 'error';

export interface RowPlan<T> {
  line: number;
  /** Cosa identifica la riga in anteprima: username, numero, titolo */
  key: string;
  status: RowStatus;
  changes: string[];
  warnings: string[];
  errors: string[];
  data: T | null;
}

export interface CsvPlan<T> {
  rows: RowPlan<T>[];
  /** Problemi che bloccano l'intero file (es. colonne obbligatorie mancanti) */
  fileErrors: string[];
  unknownColumns: string[];
  ignoredColumns: string[];
}

export interface ApplyResult {
  line: number;
  key: string;
  ok: boolean;
  message?: string;
}

export type ApplyProgress = (done: number, total: number) => void;

/** Errori di file comuni a tutti gli import, dalla lettura delle colonne. */
export function tableFileErrors(table: CsvTable<string>): string[] {
  if (table.records.length === 0 && table.missing.length === 0) return ['Il file non contiene righe da importare.'];
  if (table.missing.length > 0) {
    return [`Mancano le colonne obbligatorie: ${table.missing.join(', ')}.`];
  }
  return [];
}

/** Riga in costruzione: lo stato si decide alla fine da errori e modifiche. */
export class RowPlanBuilder<T> {
  readonly changes: string[] = [];
  readonly warnings: string[] = [];
  readonly errors: string[] = [];
  constructor(readonly line: number, public key: string) {}

  change(text: string) { this.changes.push(text); }
  warn(text: string) { this.warnings.push(text); }
  error(text: string) { this.errors.push(text); }

  /** Aggiunge la modifica di un campo solo se il valore cambia davvero. */
  diff(label: string, before: unknown, after: unknown): boolean {
    if (sameValue(before, after)) return false;
    this.changes.push(`${label}: ${shown(before)} → ${shown(after)}`);
    return true;
  }

  build(isNew: boolean, data: T): RowPlan<T> {
    const base = { line: this.line, key: this.key, changes: this.changes, warnings: this.warnings, errors: this.errors };
    if (this.errors.length > 0) return { ...base, status: 'error', data: null };
    if (isNew) return { ...base, status: 'new', data };
    return { ...base, status: this.changes.length > 0 ? 'update' : 'same', data };
  }
}

function emptyish(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (emptyish(a) && emptyish(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

function shown(v: unknown): string {
  if (emptyish(v)) return '(vuoto)';
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  return `"${s.length > 60 ? s.slice(0, 57) + '…' : s}"`;
}

export function summarize(rows: readonly RowPlan<unknown>[]): Record<RowStatus, number> {
  const counts: Record<RowStatus, number> = { new: 0, update: 0, same: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

/** Righe da scrivere: nuove e modificate. */
export function rowsToApply<T>(rows: readonly RowPlan<T>[]): (RowPlan<T> & { data: T })[] {
  return rows.filter((r): r is RowPlan<T> & { data: T } => (r.status === 'new' || r.status === 'update') && r.data !== null);
}

// --- Celle ------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

/** Testo opzionale: vuoto = null. */
export function textOrNull(value: string | undefined): string | null {
  return value ? value : null;
}

export function parseIntCell(value: string, label: string, opts: { min?: number; max?: number } = {}): Parsed<number | null> {
  if (value === '') return ok(null);
  if (!/^-?\d+$/.test(value)) return fail(`${label}: "${value}" non è un numero intero`);
  const n = Number(value);
  if (opts.min !== undefined && n < opts.min) return fail(`${label}: deve essere almeno ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) return fail(`${label}: deve essere al massimo ${opts.max}`);
  return ok(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Data del foglio (gg/mm/aaaa, g/m/aa, aaaa-mm-gg) come YYYY-MM-DD; vuota = null. */
export function parseItDate(value: string, label: string): Parsed<string | null> {
  if (value === '') return ok(null);
  let y: number, m: number, d: number;
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!match) return fail(`${label}: "${value}" non è una data (usa gg/mm/aaaa)`);
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return fail(`${label}: "${value}" non è una data valida`);
  }
  return ok(`${y}-${pad(m)}-${pad(d)}`);
}

/** YYYY-MM-DD → gg/mm/aaaa */
export function formatItDate(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Ora "17:30", "17.30" o "17:30:00" come HH:MM; vuota = null. */
export function parseTimeCell(value: string, label: string): Parsed<string | null> {
  if (value === '') return ok(null);
  const m = value.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return fail(`${label}: "${value}" non è un orario (usa hh:mm)`);
  return ok(`${pad(Number(m[1]))}:${m[2]}`);
}

/** HH:MM:SS del database → HH:MM */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/** Indice = giorno della settimana di lesson_days (0 = domenica). */
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** "Lun, Mer" o "lunedì e mercoledì" → [1, 3]; vuoto = []. */
export function parseDays(value: string, label: string): Parsed<number[]> {
  const parts = value.split(/[,;/+]|\s+e\s+|\s+/).map((p) => normalizeKey(p)).filter(Boolean);
  const days = new Set<number>();
  for (const p of parts) {
    const i = DAY_NAMES.findIndex((d) => p.startsWith(normalizeKey(d)));
    if (i < 0) return fail(`${label}: "${p}" non è un giorno (usa Lun, Mar, Mer, Gio, Ven, Sab, Dom)`);
    days.add(i);
  }
  return ok([...days].sort((a, b) => a - b));
}

/** [0, 3] → "Mer, Dom": dal lunedì, come sul calendario italiano. */
export function formatDays(days: readonly number[] | null | undefined): string {
  return [...(days ?? [])]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAY_NAMES[d])
    .join(', ');
}

/** Elenco separato da virgole (o a capo), senza vuoti né doppioni. */
export function parseList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Link opzionale: vuoto = null. Un testo che non è un link http(s) passa con un
 * avviso, così i dati vecchi esportati si possono reimportare così come sono.
 */
export function linkCell(row: RowPlanBuilder<unknown>, value: string, label: string): string | null {
  if (value === '') return null;
  if (!isHttpUrl(value)) row.warn(`${label}: "${value}" non sembra un link http(s)`);
  return value;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CourseRef {
  id: string;
  title: string;
  slug?: string | null;
}

/** Corso per titolo o slug, senza badare a maiuscole e accenti. */
export function matchCourse<C extends CourseRef>(value: string, courses: readonly C[]): C | undefined {
  const k = normalizeKey(value);
  return courses.find((c) => normalizeKey(c.title) === k) ?? courses.find((c) => !!c.slug && normalizeKey(c.slug) === k);
}

/** Data di oggi per i nomi dei file */
export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

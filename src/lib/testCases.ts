// Correzione automatica: casi di prova di task e compiti (colonna test_cases).
// I casi sono visibili allo studente e girano nel browser:
//   - Python: in un Web Worker con Pyodide (src/lib/pythonTestRunner.ts)
//   - Web: in un iframe nascosto con l'anteprima (src/lib/webTestRunner.ts)
// Alla consegna di un compito la % di casi superati diventa il voto proposto
// (homework_submissions.auto_score), che l'insegnante conferma o modifica.

export type OutputMatch = 'exact' | 'trim' | 'contains';

interface BaseCase {
  id: string;
  name: string;
  hint?: string;
}

// Python
export interface IoCase extends BaseCase { kind: 'io'; stdin?: string; expected: string; match: OutputMatch }
export interface AssertCase extends BaseCase { kind: 'assert'; code: string; stdin?: string }
// Web
export interface DomExistsCase extends BaseCase { kind: 'dom-exists'; selector: string }
export interface DomTextCase extends BaseCase { kind: 'dom-text'; selector: string; contains: string }
export interface DomCountCase extends BaseCase { kind: 'dom-count'; selector: string; min: number; max?: number }
export interface CssCase extends BaseCase { kind: 'css'; selector: string; property: string; value: string }
export interface JsCase extends BaseCase { kind: 'js'; expression: string }

export type PythonTestCase = IoCase | AssertCase;
export type WebTestCase = DomExistsCase | DomTextCase | DomCountCase | CssCase | JsCase;
export type TestCase = PythonTestCase | WebTestCase;
export type TestCaseKind = TestCase['kind'];

export interface TestResult {
  id: string;
  passed: boolean;
  // Output ottenuto (Python io) o valore trovato (Web), per il confronto
  actual?: string;
  error?: string;
}

export const PYTHON_KINDS: TestCaseKind[] = ['io', 'assert'];
export const WEB_KINDS: TestCaseKind[] = ['dom-exists', 'dom-text', 'dom-count', 'css', 'js'];

export const KIND_LABELS: Record<TestCaseKind, string> = {
  io: 'Input → output',
  assert: 'Assert Python',
  'dom-exists': 'Elemento presente',
  'dom-text': 'Testo dell\'elemento',
  'dom-count': 'Numero di elementi',
  css: 'Stile CSS',
  js: 'Espressione JavaScript',
};

export const TEST_TIMEOUT_MS = 5000;
export const TIMEOUT_ERROR = 'Tempo scaduto (ciclo infinito?)';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

let idCounter = 0;
export function newTestCaseId(): string {
  idCounter += 1;
  return `t${Date.now().toString(36)}${idCounter}`;
}

// Valida il JSON salvato e scarta i casi incompleti, così un caso malformato
// non blocca gli altri.
export function parseTestCases(raw: unknown): TestCase[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];

  const out: TestCase[] = [];
  const seen = new Set<string>();
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const c = item as Record<string, unknown>;
    let id = str(c.id).trim() || `t${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    const base: BaseCase = { id, name: str(c.name).trim() || `Test ${i + 1}` };
    if (str(c.hint).trim()) base.hint = str(c.hint).trim();

    switch (c.kind) {
      case 'io': {
        if (c.expected == null) return;
        const match: OutputMatch = c.match === 'exact' || c.match === 'contains' ? c.match : 'trim';
        const tc: IoCase = { ...base, kind: 'io', expected: str(c.expected), match };
        if (str(c.stdin)) tc.stdin = str(c.stdin);
        out.push(tc);
        break;
      }
      case 'assert': {
        if (!str(c.code).trim()) return;
        const tc: AssertCase = { ...base, kind: 'assert', code: str(c.code) };
        if (str(c.stdin)) tc.stdin = str(c.stdin);
        out.push(tc);
        break;
      }
      case 'dom-exists':
        if (!str(c.selector).trim()) return;
        out.push({ ...base, kind: 'dom-exists', selector: str(c.selector).trim() });
        break;
      case 'dom-text':
        if (!str(c.selector).trim()) return;
        out.push({ ...base, kind: 'dom-text', selector: str(c.selector).trim(), contains: str(c.contains) });
        break;
      case 'dom-count': {
        if (!str(c.selector).trim()) return;
        const min = Number.isFinite(Number(c.min)) ? Math.max(0, Math.floor(Number(c.min))) : 1;
        const tc: DomCountCase = { ...base, kind: 'dom-count', selector: str(c.selector).trim(), min };
        if (c.max != null && c.max !== '' && Number.isFinite(Number(c.max))) tc.max = Math.floor(Number(c.max));
        out.push(tc);
        break;
      }
      case 'css':
        if (!str(c.selector).trim() || !str(c.property).trim()) return;
        out.push({
          ...base, kind: 'css', selector: str(c.selector).trim(),
          property: str(c.property).trim(), value: str(c.value).trim(),
        });
        break;
      case 'js':
        if (!str(c.expression).trim()) return;
        out.push({ ...base, kind: 'js', expression: str(c.expression) });
        break;
      default:
        return;
    }
    seen.add(id);
  });
  return out;
}

export function isPythonCase(c: TestCase): c is PythonTestCase {
  return c.kind === 'io' || c.kind === 'assert';
}

export function pythonCases(cases: TestCase[]): PythonTestCase[] {
  return cases.filter(isPythonCase);
}

export function webCases(cases: TestCase[]): WebTestCase[] {
  return cases.filter((c): c is WebTestCase => !isPythonCase(c));
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}

function stripTrailing(s: string): string {
  return normalizeNewlines(s)
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function compareOutput(actual: string, expected: string, match: OutputMatch): boolean {
  switch (match) {
    case 'exact':
      // Tollera solo l'a capo finale che print() aggiunge sempre
      return normalizeNewlines(actual).replace(/\n$/, '') === normalizeNewlines(expected).replace(/\n$/, '');
    case 'contains':
      return stripTrailing(actual).includes(stripTrailing(expected));
    case 'trim':
    default:
      return stripTrailing(actual).trim() === stripTrailing(expected).trim();
  }
}

// Valori CSS calcolati: confronto senza spazi e maiuscole ("rgb(255, 0, 0)" = "rgb(255,0,0)")
export function compareCssValue(actual: string, expected: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  return norm(actual) === norm(expected);
}

export function scoreResults(results: Pick<TestResult, 'passed'>[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.passed).length;
  return Math.round((passed / results.length) * 100);
}

export function allPassed(cases: TestCase[], results: TestResult[] | null | undefined): boolean {
  if (!results || cases.length === 0) return false;
  return cases.every((c) => results.find((r) => r.id === c.id)?.passed);
}

// Le colonne jsonb salvano risultati con forme non garantite: normalizza.
export function parseTestResults(raw: unknown): TestResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as any).id === 'string')  // eslint-disable-line @typescript-eslint/no-explicit-any
    .map((r) => {
      const out: TestResult = { id: r.id as string, passed: r.passed === true };
      if (typeof r.actual === 'string') out.actual = r.actual.slice(0, 2000);
      if (typeof r.error === 'string') out.error = r.error.slice(0, 2000);
      return out;
    });
}

// Breve descrizione del caso, mostrata accanto al nome
export function describeCase(c: TestCase): string {
  switch (c.kind) {
    case 'io': {
      const input = c.stdin ? `input: ${c.stdin.replace(/\n/g, ' ⏎ ')}` : 'senza input';
      return `${input} → atteso: ${c.expected.replace(/\n/g, ' ⏎ ')}`;
    }
    case 'assert': return c.code;
    case 'dom-exists': return `esiste ${c.selector}`;
    case 'dom-text': return `${c.selector} contiene "${c.contains}"`;
    case 'dom-count': return c.max != null ? `${c.selector}: da ${c.min} a ${c.max}` : `${c.selector}: almeno ${c.min}`;
    case 'css': return `${c.selector} { ${c.property}: ${c.value} }`;
    case 'js': return c.expression;
  }
}

// Feedback precompilato per l'insegnante con i test non superati
export function failedTestsFeedback(cases: TestCase[], results: TestResult[]): string {
  const failed = cases.filter((c) => !results.find((r) => r.id === c.id)?.passed);
  const passedCount = cases.length - failed.length;
  if (failed.length === 0) return `Ottimo lavoro: hai superato tutti i ${cases.length} test! 🎉`;
  const lines = failed.map((c) => `• ${c.name}${c.hint ? ` (suggerimento: ${c.hint})` : ''}`);
  return `Test superati: ${passedCount}/${cases.length}.\nDa sistemare:\n${lines.join('\n')}`;
}

// Le consegne dal compilatore salvano il codice in notes con il prefisso "[CODE]"
const CODE_PREFIX = '[CODE]\n';

export function parseSubmittedCode(notes: string | null | undefined): string | null {
  if (!notes || !notes.startsWith(CODE_PREFIX)) return null;
  return notes.slice(CODE_PREFIX.length);
}

// Editor admin: durante la modifica un caso può essere incompleto, si valida al salvataggio
export type EditableTestCase = { id: string; kind: TestCaseKind; name: string } & Record<string, unknown>;

export function toEditableCases(raw: unknown): EditableTestCase[] {
  return parseTestCases(raw) as unknown as EditableTestCase[];
}

/** Quanti casi verrebbero scartati al salvataggio perché incompleti */
export function countIncompleteCases(cases: EditableTestCase[]): number {
  return cases.length - parseTestCases(cases).length;
}

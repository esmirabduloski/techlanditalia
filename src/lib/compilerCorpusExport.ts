/**
 * Export dei task e compiti con codice per i test dei compilatori
 * (e2e/compilatori/task-reali.json): ogni aggiornamento di Pyodide, Skulpt o dei
 * compilatori viene provato sul codice di partenza vero dei corsi.
 * Contiene solo contenuti dei corsi, nessun dato degli alunni.
 */
import { supabase } from '@/integrations/supabase/client';
import { resolveCompiler, type CompilerKind } from './compilerKind';
import { PYODIDE_VERSION, SKULPT_VERSION } from './runtimes';

interface Allegato { name: string; url: string; type: string }

export interface CorpusAllegato extends Allegato {
  /** Testo dei CSS/JS allegati, così i test non dipendono dallo storage */
  contenuto?: string;
}

export interface CorpusTask {
  tipo: 'task' | 'compito';
  id: string;
  titolo: string;
  corso: string;
  lezione: number | null;
  numero: number | null;
  compilatore: CompilerKind;
  visibile: boolean;
  python_env: string | null;
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  test_cases: unknown[];
  replit_url: string | null;
  preview_only: boolean;
  allegati: CorpusAllegato[];
}

export interface Corpus {
  esportato_il: string;
  versioni: { pyodide: string; skulpt: string };
  task: CorpusTask[];
}

interface CodeColumns {
  id: string;
  title: string;
  python_env: string | null;
  replit_url: string | null;
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  test_cases: unknown;
  attachments: unknown;
  lessons: { lesson_number: number | null; courses: { slug: string | null } | null } | null;
}

export interface TaskRow extends CodeColumns {
  task_number: number | null;
  content_type: string | null;
  is_visible: boolean | null;
}

export interface HomeworkRow extends CodeColumns {
  preview_only: boolean | null;
}

function parseAllegati(raw: unknown): Allegato[] {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(list)
    ? list.filter((a): a is Allegato => !!a && typeof a.url === 'string' && typeof a.name === 'string' && typeof a.type === 'string')
    : [];
}

/** URL dei CSS/JS allegati da scaricare per inserirne il testo nell'export. */
export function attachmentUrlsToInline(tasks: TaskRow[]): string[] {
  const urls = tasks.flatMap((t) => parseAllegati(t.attachments).filter((a) => a.type === 'css' || a.type === 'js').map((a) => a.url));
  return [...new Set(urls)];
}

/** Trasforma le righe del DB nel file di export (pura: testata in compilerCorpusExport.test.ts). */
export function buildCorpus(tasks: TaskRow[], homework: HomeworkRow[], contenuti: Record<string, string>, esportatoIl: Date): Corpus {
  const comune = (row: CodeColumns) => {
    const corso = row.lessons?.courses?.slug ?? '';
    const compilatore = resolveCompiler(corso, row);
    return compilatore && {
      id: row.id,
      titolo: row.title,
      corso,
      lezione: row.lessons?.lesson_number ?? null,
      compilatore,
      python_env: row.python_env,
      default_python_code: row.default_python_code,
      default_html_code: row.default_html_code,
      default_css_code: row.default_css_code,
      default_js_code: row.default_js_code,
      test_cases: Array.isArray(row.test_cases) ? row.test_cases : [],
      replit_url: row.replit_url,
      allegati: parseAllegati(row.attachments).map((a) => (a.url in contenuti ? { ...a, contenuto: contenuti[a.url] } : a)),
    };
  };

  const items: CorpusTask[] = [];
  for (const t of tasks) {
    // Il compilatore si apre solo nei task "misti"
    if (t.content_type !== 'mixed') continue;
    const base = comune(t);
    if (base) items.push({ tipo: 'task', ...base, numero: t.task_number, visibile: t.is_visible !== false, preview_only: false });
  }
  for (const h of homework) {
    const base = comune(h);
    // I compiti non hanno allegati nel compilatore
    if (base) items.push({ tipo: 'compito', ...base, numero: null, visibile: true, preview_only: !!h.preview_only, allegati: [] });
  }

  const ordine = (t: CorpusTask) => [t.corso, String(t.lezione ?? 0).padStart(4, '0'), t.tipo, String(t.numero ?? 0).padStart(4, '0'), t.id].join('|');
  items.sort((a, b) => ordine(a).localeCompare(ordine(b)));

  return {
    esportato_il: esportatoIl.toISOString(),
    versioni: { pyodide: PYODIDE_VERSION, skulpt: SKULPT_VERSION },
    task: items,
  };
}

const CODE_COLUMNS = 'id, title, python_env, replit_url, default_python_code, default_html_code, default_css_code, default_js_code, test_cases, attachments, lessons(lesson_number, courses(slug))';
const PAGE = 500;

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Legge task e compiti con il client dell'admin e scarica il testo dei CSS/JS allegati. */
export async function exportCompilerCorpus(): Promise<Corpus> {
  const [tasks, homework] = await Promise.all([
    fetchAll<TaskRow>((from, to) => supabase
      .from('lesson_tasks')
      .select(`${CODE_COLUMNS}, task_number, content_type, is_visible`)
      .eq('content_type', 'mixed')
      .order('id')
      .range(from, to)),
    fetchAll<HomeworkRow>((from, to) => supabase
      .from('homework')
      .select(`${CODE_COLUMNS}, preview_only`)
      .order('id')
      .range(from, to)),
  ]);

  const contenuti: Record<string, string> = {};
  await Promise.all(attachmentUrlsToInline(tasks).map(async (url) => {
    try {
      const res = await fetch(url);
      if (res.ok) contenuti[url] = await res.text();
    } catch { /* allegato non raggiungibile: resta solo l'URL */ }
  }));

  return buildCorpus(tasks, homework, contenuti, new Date());
}

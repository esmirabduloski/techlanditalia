import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { buildCsv } from '@/lib/csv';
import {
  linkCell, normalizeKey, parseIntCell, parseList, readTable, rowsToApply, RowPlanBuilder, tableFileErrors,
  textOrNull, type ApplyProgress, type ApplyResult, type CsvColumn, type CsvPlan, type RowPlan,
} from '@/lib/csvImport';
import { cleanObjective } from '@/lib/lessonObjective';
import { normalizeConcepts, SKILL_CONCEPTS } from '@/lib/skillMap';

/**
 * Programma di un corso in CSV: titolo, descrizione, obiettivo, punti, link e
 * competenze di ogni lezione. Contenuto HTML, immagini, task e compiti restano
 * nell'editor della lezione e l'import non li tocca.
 */

export type LessonColumnKey = 'number' | 'title' | 'description' | 'objective' | 'points' | 'video' | 'slides' | 'concepts';

/** Punti di una lezione nuova, come in LessonEditor */
export const DEFAULT_LESSON_POINTS = 50;

export const LESSON_COLUMNS: CsvColumn<LessonColumnKey>[] = [
  { key: 'number', header: 'Numero', aliases: ['n', 'numero lezione', 'lezione', 'lesson number'], required: true, hint: 'Identifica la lezione nel corso: se esiste viene aggiornata, altrimenti creata.' },
  { key: 'title', header: 'Titolo', required: true },
  { key: 'description', header: 'Descrizione' },
  { key: 'objective', header: 'Obiettivo', hint: 'La frase dopo "Oggi imparerai a…".' },
  { key: 'points', header: 'Punti', hint: `Vuoto = ${DEFAULT_LESSON_POINTS}.` },
  { key: 'video', header: 'Video', aliases: ['link video', 'video url'] },
  { key: 'slides', header: 'Slide', aliases: ['slides', 'link slide', 'slides url'] },
  { key: 'concepts', header: 'Competenze', aliases: ['concetti'], hint: `Separate da virgola: ${SKILL_CONCEPTS.map((c) => c.id).join(', ')}.` },
];

export interface CsvLesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  objective: string | null;
  points_reward: number;
  video_url: string | null;
  slides_url: string | null;
  /** Assente prima della migrazione della mappa delle competenze */
  concepts?: string[] | null;
}

type LessonFields = Pick<
  TablesInsert<'lessons'>,
  'title' | 'description' | 'objective' | 'points_reward' | 'video_url' | 'slides_url' | 'concepts'
>;

export interface LessonImport {
  /** null = lezione nuova */
  id: string | null;
  lesson_number: number;
  /** Lezione nuova: tutti i campi del file. Esistente: solo quelli cambiati. */
  fields: Partial<LessonFields>;
}

const headers = LESSON_COLUMNS.map((c) => c.header);

export function lessonsToCsv(lessons: readonly CsvLesson[]): string {
  const rows = [...lessons]
    .sort((a, b) => a.lesson_number - b.lesson_number)
    .map((l) => [
      l.lesson_number, l.title, l.description ?? '', l.objective ?? '', l.points_reward,
      l.video_url ?? '', l.slides_url ?? '', normalizeConcepts(l.concepts).join(', '),
    ]);
  return buildCsv(headers, rows);
}

export function lessonsTemplateCsv(): string {
  return buildCsv(headers, [[
    1, 'Il primo programma', 'Scopriamo come si scrive un programma', 'scrivere il tuo primo programma',
    DEFAULT_LESSON_POINTS, '', '', 'sequenze, variabili',
  ]]);
}

/** Id del catalogo (o etichette intere, che possono contenere virgole) → id normalizzati. */
function parseConcepts(value: string): { ids: string[]; unknown: string[] } {
  let text = normalizeKey(value);
  for (const c of [...SKILL_CONCEPTS].sort((a, b) => b.label.length - a.label.length)) {
    text = text.split(normalizeKey(c.label)).join(c.id);
  }
  const tokens = parseList(text);
  const known = new Set(SKILL_CONCEPTS.map((c) => c.id));
  return {
    ids: normalizeConcepts(tokens.filter((t) => known.has(t))),
    unknown: tokens.filter((t) => !known.has(t)),
  };
}

export function planLessons(
  rows: string[][],
  existing: readonly CsvLesson[],
  opts: { totalLessons?: number | null } = {},
): CsvPlan<LessonImport> {
  const table = readTable(rows, LESSON_COLUMNS);
  const fileErrors = tableFileErrors(table);
  const plan: CsvPlan<LessonImport> = { rows: [], fileErrors, unknownColumns: table.unknown, ignoredColumns: table.ignored };
  if (fileErrors.length > 0) return plan;

  const byNumber = new Map(existing.map((l) => [l.lesson_number, l]));
  const seen = new Map<number, number>();

  for (const { line, values: v } of table.records) {
    const row = new RowPlanBuilder<LessonImport>(line, v.number ? `Lezione ${v.number}` : '—');
    const fields: Partial<LessonFields> = {};

    const num = parseIntCell(v.number ?? '', 'Numero', { min: 1, max: 999 });
    let number = 0;
    if (!num.ok) row.error(num.error);
    else if (num.value === null) row.error('Numero mancante');
    else {
      number = num.value;
      if (seen.has(number)) row.error(`Numero ${number} già usato alla riga ${seen.get(number)}`);
      else seen.set(number, line);
    }

    if (!v.title) row.error('Titolo mancante');
    else fields.title = v.title;
    if (v.title) row.key = `${number || v.number}. ${v.title}`;

    if (table.present.has('description')) fields.description = textOrNull(v.description);
    if (table.present.has('objective')) fields.objective = cleanObjective(v.objective) || null;

    if (table.present.has('points')) {
      const p = parseIntCell(v.points ?? '', 'Punti', { min: 0, max: 10000 });
      if (!p.ok) row.error(p.error);
      else fields.points_reward = p.value ?? DEFAULT_LESSON_POINTS;
    }

    if (table.present.has('video')) fields.video_url = linkCell(row, v.video ?? '', 'Video');
    if (table.present.has('slides')) fields.slides_url = linkCell(row, v.slides ?? '', 'Slide');

    if (table.present.has('concepts')) {
      const c = parseConcepts(v.concepts ?? '');
      if (c.unknown.length > 0) row.error(`Competenze sconosciute: ${c.unknown.join(', ')}`);
      else fields.concepts = c.ids;
    }

    const current = number ? byNumber.get(number) : undefined;
    if (!current) {
      if (number && opts.totalLessons && number > opts.totalLessons) {
        row.warn(`Il corso prevede ${opts.totalLessons} lezioni: questa è oltre e non compare nella navigazione finché non aggiorni il numero di lezioni del corso.`);
      }
      row.change('Nuova lezione');
      plan.rows.push(row.build(true, { id: null, lesson_number: number, fields }));
      continue;
    }

    const changed: Partial<LessonFields> = {};
    const compare = <F extends keyof LessonFields>(field: F, label: string, before: LessonFields[F]) => {
      if (!(field in fields)) return;
      if (row.diff(label, before, fields[field])) changed[field] = fields[field];
    };
    compare('title', 'Titolo', current.title);
    compare('description', 'Descrizione', current.description);
    compare('objective', 'Obiettivo', cleanObjective(current.objective) || null);
    compare('points_reward', 'Punti', current.points_reward);
    compare('video_url', 'Video', current.video_url);
    compare('slides_url', 'Slide', current.slides_url);
    compare('concepts', 'Competenze', normalizeConcepts(current.concepts));
    plan.rows.push(row.build(false, { id: current.id, lesson_number: number, fields: changed }));
  }
  return plan;
}

export async function applyLessons(
  courseId: string,
  rows: readonly RowPlan<LessonImport>[],
  onProgress: ApplyProgress,
): Promise<ApplyResult[]> {
  const todo = rowsToApply(rows);
  const results: ApplyResult[] = [];
  for (const [i, r] of todo.entries()) {
    const { id, lesson_number, fields } = r.data;
    const { error } = id
      ? await supabase.from('lessons').update(fields).eq('id', id)
      : await supabase.from('lessons').insert({
          course_id: courseId,
          lesson_number,
          title: fields.title ?? '',
          content: null,
          content_type: 'text',
          images: [],
          points_reward: DEFAULT_LESSON_POINTS,
          ...fields,
        });
    results.push({
      line: r.line,
      key: r.key,
      ok: !error,
      message: error ? (error.code === '23505' ? `La lezione ${lesson_number} esiste già nel corso` : error.message) : undefined,
    });
    onProgress(i + 1, todo.length);
  }
  return results;
}

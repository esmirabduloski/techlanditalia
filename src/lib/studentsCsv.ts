import { supabase } from '@/integrations/supabase/client';
import { buildCsv } from '@/lib/csv';
import {
  EMAIL_RE, matchCourse, normalizeKey, parseList, readTable, rowsToApply, RowPlanBuilder, tableFileErrors,
  type ApplyProgress, type ApplyResult, type CourseRef, type CsvColumn, type CsvPlan, type RowPlan,
} from '@/lib/csvImport';

/**
 * Studenti in CSV, una riga per studente con il suo genitore.
 *
 * - Username esistente: si aggiornano nomi e si aggiungono iscrizioni ai corsi.
 *   Il genitore non si cambia da CSV (si collega da Utenti).
 * - Username nuovo: lo crea admin-import-students, sotto il genitore con
 *   quell'email o sotto un genitore nuovo.
 * Nessuna iscrizione o collegamento viene tolto.
 */

export type StudentColumnKey = 'username' | 'studentName' | 'parentName' | 'parentEmail' | 'courses' | 'groups';

export const STUDENT_COLUMNS: CsvColumn<StudentColumnKey>[] = [
  { key: 'username', header: 'Username', aliases: ['nome utente', 'user'], required: true, hint: 'Identifica lo studente: se esiste viene aggiornato, altrimenti creato.' },
  { key: 'studentName', header: 'Nome studente', aliases: ['studente', 'alunno', 'nome alunno', 'nome'], required: true },
  { key: 'parentName', header: 'Nome genitore', aliases: ['genitore'], hint: 'Obbligatorio per un genitore nuovo.' },
  { key: 'parentEmail', header: 'Email genitore', aliases: ['email', 'mail genitore'], hint: 'Obbligatoria per gli studenti nuovi: se ha già un account, lo studente gli viene collegato.' },
  { key: 'courses', header: 'Corsi', aliases: ['corso'], hint: 'Titoli separati da virgola: le iscrizioni mancanti vengono aggiunte, nessuna viene tolta.' },
  { key: 'groups', header: 'Gruppi', readOnly: true },
];

/** Righe per chiamata a admin-import-students (STUDENT_IMPORT_BATCH_MAX lato server) */
export const STUDENT_IMPORT_BATCH = 20;

/** Stesse regole di supabase/functions/_shared/studentimport.ts e del dialog "Crea utente" */
export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export interface CsvProfile {
  id: string;
  full_name: string;
  role: string;
  parent_id: string | null;
  email: string | null;
  username: string | null;
}

export interface StudentsCsvContext {
  profiles: CsvProfile[];
  courses: CourseRef[];
  enrollments: { student_id: string; course_id: string; status: string }[];
  groups: { id: string; title: string; status: string }[];
  members: { group_id: string; student_id: string }[];
}

export type StudentImport =
  | {
      kind: 'update';
      studentId: string;
      studentName?: string;
      parentRename?: { id: string; name: string };
      addCourseIds: string[];
    }
  | {
      kind: 'create';
      username: string;
      studentName: string;
      parentEmail: string;
      parentName: string;
      /** Genitore che ha già un account; null = da creare */
      parentId: string | null;
      parentRename?: { id: string; name: string };
      courseIds: string[];
    };

export async function loadStudentsCsvContext(): Promise<StudentsCsvContext> {
  const [profiles, courses, enrollments, groups, members] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, parent_id, email, username'),
    supabase.from('courses').select('id, title, slug'),
    supabase.from('enrollments').select('student_id, course_id, status'),
    supabase.from('student_groups').select('id, title, status'),
    supabase.from('group_students').select('group_id, student_id'),
  ]);
  const failed = [profiles, courses, enrollments, groups, members].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return {
    profiles: profiles.data ?? [],
    courses: courses.data ?? [],
    enrollments: enrollments.data ?? [],
    groups: groups.data ?? [],
    members: members.data ?? [],
  };
}

const headers = STUDENT_COLUMNS.map((c) => c.header);

export function studentsToCsv(ctx: StudentsCsvContext): string {
  const byId = new Map(ctx.profiles.map((p) => [p.id, p]));
  const course = new Map(ctx.courses.map((c) => [c.id, c.title]));
  const group = new Map(ctx.groups.filter((g) => g.status !== 'archived').map((g) => [g.id, g.title]));
  const rows = ctx.profiles
    .filter((p) => p.role === 'student')
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'it'))
    .map((s) => {
      const parent = s.parent_id ? byId.get(s.parent_id) : undefined;
      const courses = ctx.enrollments
        .filter((e) => e.student_id === s.id && e.status === 'active')
        .map((e) => course.get(e.course_id))
        .filter(Boolean);
      const groups = ctx.members
        .filter((m) => m.student_id === s.id)
        .map((m) => group.get(m.group_id))
        .filter(Boolean);
      return [s.username ?? '', s.full_name, parent?.full_name ?? '', parent?.email ?? '', courses.join(', '), groups.join(', ')];
    });
  return buildCsv(headers, rows);
}

export function studentsTemplateCsv(courseTitle = 'Scratch'): string {
  return buildCsv(headers, [
    ['mario_esempio', 'Mario Esempio', 'Anna Esempio', 'anna.esempio@example.com', courseTitle, ''],
    ['giulia_esempio', 'Giulia Esempio', 'Anna Esempio', 'anna.esempio@example.com', courseTitle, ''],
  ]);
}

export function planStudents(rows: string[][], ctx: StudentsCsvContext): CsvPlan<StudentImport> {
  const table = readTable(rows, STUDENT_COLUMNS);
  const fileErrors = tableFileErrors(table);
  const plan: CsvPlan<StudentImport> = { rows: [], fileErrors, unknownColumns: table.unknown, ignoredColumns: table.ignored };
  if (fileErrors.length > 0) return plan;

  const byId = new Map(ctx.profiles.map((p) => [p.id, p]));
  const byUsername = new Map(ctx.profiles.filter((p) => p.username).map((p) => [p.username!.trim().toLowerCase(), p]));
  const byEmail = new Map(ctx.profiles.filter((p) => p.email).map((p) => [p.email!.trim().toLowerCase(), p]));
  const courseTitle = new Map(ctx.courses.map((c) => [c.id, c.title]));
  const seenUsernames = new Map<string, number>();
  // Nome del genitore già deciso da una riga precedente (fratelli), per email
  const parentNames = new Map<string, { name: string; line: number }>();

  for (const { line, values: v } of table.records) {
    const raw = v.username ?? '';
    const row = new RowPlanBuilder<StudentImport>(line, raw || '—');
    const studentName = v.studentName ?? '';
    const parentEmail = (v.parentEmail ?? '').toLowerCase();
    const parentName = v.parentName ?? '';

    if (!raw) row.error('Username mancante');
    if (!studentName) row.error('Nome dello studente mancante');
    if (parentEmail && !EMAIL_RE.test(parentEmail)) row.error(`Email del genitore "${v.parentEmail}" non valida`);

    // Prima l'username così com'è (anche se vecchio e con punti o maiuscole), poi normalizzato
    const existing = raw ? byUsername.get(raw.toLowerCase()) ?? byUsername.get(sanitizeUsername(raw)) : undefined;
    const username = existing?.username ?? sanitizeUsername(raw);
    if (existing && existing.role !== 'student') {
      row.error(`"${raw}" è l'username di un account che non è uno studente`);
      plan.rows.push(row.build(false, { kind: 'update', studentId: existing.id, addCourseIds: [] }));
      continue;
    }
    if (username) {
      if (seenUsernames.has(username)) row.error(`Username già presente alla riga ${seenUsernames.get(username)}`);
      else seenUsernames.set(username, line);
    }
    if (raw && !username) row.error(`Username "${raw}" non valido: usa lettere, numeri e _`);

    const courseIds: string[] = [];
    if (table.present.has('courses')) {
      const unknown: string[] = [];
      for (const name of parseList(v.courses ?? '')) {
        const c = matchCourse(name, ctx.courses);
        if (!c) unknown.push(name);
        else if (!courseIds.includes(c.id)) courseIds.push(c.id);
      }
      if (unknown.length) row.error(`Corsi non trovati: ${unknown.join(', ')}`);
    }

    // Il genitore con questa email ha già un account?
    const knownParent = parentEmail ? byEmail.get(parentEmail) : undefined;
    const checkParentName = () => {
      if (!parentEmail || !parentName) return;
      const prev = parentNames.get(parentEmail);
      if (prev && normalizeKey(prev.name) !== normalizeKey(parentName)) {
        row.error(`Nome del genitore diverso dalla riga ${prev.line} ("${prev.name}")`);
      } else if (!prev) {
        parentNames.set(parentEmail, { name: parentName, line });
      }
    };
    const renameOf = (parent: CsvProfile | undefined) => {
      if (!parent || !parentName || !table.present.has('parentName')) return undefined;
      return row.diff('Nome genitore', parent.full_name, parentName) ? { id: parent.id, name: parentName } : undefined;
    };

    if (existing) {
      row.key = existing.username ?? raw;
      const data: StudentImport & { kind: 'update' } = { kind: 'update', studentId: existing.id, addCourseIds: [] };
      if (row.diff('Nome studente', existing.full_name, studentName)) data.studentName = studentName;

      const parent = existing.parent_id ? byId.get(existing.parent_id) : undefined;
      if (parentEmail) {
        if (!parent) row.error('Lo studente non ha un genitore collegato: collegalo da Utenti');
        else if ((parent.email ?? '').toLowerCase() !== parentEmail) {
          row.error(`Il genitore nel file (${parentEmail}) non è quello collegato (${parent.email ?? parent.full_name}): cambialo da Utenti`);
        }
      }
      checkParentName();
      data.parentRename = renameOf(parent);

      if (table.present.has('courses')) {
        const mine = ctx.enrollments.filter((e) => e.student_id === existing.id);
        for (const id of courseIds) {
          const e = mine.find((x) => x.course_id === id);
          if (!e) data.addCourseIds.push(id);
          else if (e.status !== 'active') row.warn(`Iscrizione a ${courseTitle.get(id)} in stato "${e.status}": non viene modificata`);
        }
        if (data.addCourseIds.length) row.change(`Nuove iscrizioni: ${data.addCourseIds.map((id) => courseTitle.get(id)).join(', ')}`);
        const kept = mine.filter((e) => e.status === 'active' && !courseIds.includes(e.course_id)).map((e) => courseTitle.get(e.course_id));
        if (kept.length) row.warn(`Resta iscritto anche a: ${kept.join(', ')}`);
      }
      plan.rows.push(row.build(false, data));
      continue;
    }

    // Studente nuovo
    row.key = username || raw || '—';
    if (username && username !== raw) row.warn(`Username normalizzato in "${username}"`);
    if (!parentEmail) row.error('Per uno studente nuovo serve l’email del genitore');
    if (knownParent && knownParent.role !== 'parent') {
      row.error(`L'email ${parentEmail} è di un account che non è un genitore: collega lo studente da Utenti`);
    }
    if (!knownParent && parentEmail && !parentName && !parentNames.has(parentEmail)) {
      row.error('Per un genitore nuovo serve il nome');
    }
    checkParentName();

    const isKnownParent = knownParent?.role === 'parent';
    const parentRename = isKnownParent ? renameOf(knownParent) : undefined;
    if (isKnownParent) row.change(`Nuovo studente, figlio di ${knownParent.full_name} (${parentEmail})`);
    else if (parentEmail && parentNames.get(parentEmail)?.line !== line) row.change(`Nuovo studente, figlio del genitore nuovo della riga ${parentNames.get(parentEmail)?.line} (${parentEmail})`);
    else row.change(`Nuovo studente e nuovo genitore: ${parentName} (${parentEmail})`);
    if (courseIds.length) row.change(`Iscrizioni: ${courseIds.map((id) => courseTitle.get(id)).join(', ')}`);

    plan.rows.push(row.build(true, {
      kind: 'create',
      username,
      studentName,
      parentEmail,
      parentName: isKnownParent ? (parentName || knownParent.full_name) : (parentNames.get(parentEmail)?.name ?? parentName),
      parentId: isKnownParent ? knownParent.id : null,
      parentRename,
      courseIds,
    }));
  }
  return plan;
}

/** Messaggio di una chiamata non andata a buon fine: con i 4xx il corpo è in error.context. */
async function invokeErrorMessage(error: unknown, data: { error?: string } | null): Promise<string> {
  if (data?.error) return data.error;
  if (error && typeof error === 'object' && 'context' in error) {
    try {
      const payload = await ((error as { context: Response }).context).clone().json();
      if (payload?.error) return payload.error as string;
    } catch {
      // corpo non leggibile
    }
  }
  return error instanceof Error ? error.message : 'Servizio di import non raggiungibile';
}

/**
 * Blocchi per admin-import-students: i fratelli (stessa email del genitore)
 * restano nello stesso blocco, così il genitore nuovo si crea una volta sola.
 */
export function batchCreations<T extends { data: { parentEmail: string } }>(rows: readonly T[], size = STUDENT_IMPORT_BATCH): T[][] {
  const families = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.data.parentEmail;
    families.set(k, [...(families.get(k) ?? []), r]);
  }
  const batches: T[][] = [];
  let current: T[] = [];
  for (const family of families.values()) {
    if (current.length > 0 && current.length + family.length > size) {
      batches.push(current);
      current = [];
    }
    for (const r of family) {
      if (current.length === size) {
        batches.push(current);
        current = [];
      }
      current.push(r);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

export async function applyStudents(
  rows: readonly RowPlan<StudentImport>[],
  opts: { sendWelcome: boolean },
  onProgress: ApplyProgress,
): Promise<ApplyResult[]> {
  const todo = rowsToApply(rows);
  const results: ApplyResult[] = [];
  let done = 0;
  const tick = () => onProgress(++done, todo.length);
  const renamed = new Set<string>();

  const renameParent = async (rename?: { id: string; name: string }): Promise<string | null> => {
    if (!rename || renamed.has(rename.id)) return null;
    renamed.add(rename.id);
    const { error } = await supabase.from('profiles').update({ full_name: rename.name }).eq('id', rename.id);
    return error ? `nome del genitore non aggiornato (${error.message})` : null;
  };

  // Aggiornamenti: con le policy admin, come il resto della pagina Utenti
  for (const r of todo) {
    if (r.data.kind !== 'update') continue;
    const d = r.data;
    const problems: string[] = [];
    if (d.studentName) {
      const { error } = await supabase.from('profiles').update({ full_name: d.studentName }).eq('id', d.studentId);
      if (error) problems.push(`nome non aggiornato (${error.message})`);
    }
    const p = await renameParent(d.parentRename);
    if (p) problems.push(p);
    for (const courseId of d.addCourseIds) {
      const { error } = await supabase.from('enrollments').insert({ student_id: d.studentId, course_id: courseId, status: 'active' });
      if (error) problems.push(`iscrizione non aggiunta (${error.message})`);
    }
    results.push({ line: r.line, key: r.key, ok: problems.length === 0, message: problems.join('; ') || undefined });
    tick();
  }

  // Creazioni: dalla edge function, a blocchi
  const creations = todo.filter((r): r is typeof r & { data: StudentImport & { kind: 'create' } } => r.data.kind === 'create');
  let stopped: string | null = null;
  for (const batch of batchCreations(creations)) {
    if (stopped) {
      for (const r of batch) {
        results.push({ line: r.line, key: r.key, ok: false, message: `Non importata: ${stopped}` });
        tick();
      }
      continue;
    }
    const renameProblems = new Map<number, string>();
    for (const r of batch) {
      const p = await renameParent(r.data.parentRename);
      if (p) renameProblems.set(r.line, p);
    }
    const { data, error } = await supabase.functions.invoke('admin-import-students', {
      body: {
        sendWelcome: opts.sendWelcome,
        rows: batch.map((r) => ({
          line: r.line,
          parentEmail: r.data.parentEmail,
          parentName: r.data.parentName,
          studentName: r.data.studentName,
          username: r.data.username,
          courseIds: r.data.courseIds,
        })),
      },
    });
    if (error || !Array.isArray(data?.results)) {
      // Errore dell'intera chiamata (2FA, limite orario, rete): inutile insistere
      stopped = await invokeErrorMessage(error, data);
      for (const r of batch) {
        results.push({ line: r.line, key: r.key, ok: false, message: `Non importata: ${stopped}` });
        tick();
      }
      continue;
    }
    const byLine = new Map((data.results as { line: number; ok: boolean; error?: string }[]).map((x) => [x.line, x]));
    for (const r of batch) {
      const res = byLine.get(r.line);
      const extra = renameProblems.get(r.line);
      const message = [res?.ok ? null : res?.error ?? 'Nessuna risposta per questa riga', extra].filter(Boolean).join('; ');
      results.push({ line: r.line, key: r.key, ok: !!res?.ok && !extra, message: message || undefined });
      tick();
    }
  }
  return results.sort((a, b) => a.line - b.line);
}

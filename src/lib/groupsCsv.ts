import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { buildCsv } from '@/lib/csv';
import {
  EMAIL_RE, formatDays, formatItDate, formatTime, linkCell, matchCourse, normalizeKey, parseDays, parseIntCell,
  parseItDate, parseList, parseTimeCell, readTable, rowsToApply, RowPlanBuilder, tableFileErrors,
  type ApplyProgress, type ApplyResult, type CourseRef, type CsvColumn, type CsvPlan, type RowPlan,
} from '@/lib/csvImport';

/**
 * Gruppi in CSV. Un gruppo nuovo riceve il calendario dal trigger
 * auto_generate_lesson_schedule (salta le chiusure); per uno esistente il
 * calendario non viene rigenerato. Gli studenti si aggiungono soltanto.
 */

export type GroupColumnKey =
  | 'id' | 'title' | 'course' | 'teacher' | 'startDate' | 'days' | 'time' | 'maxLessons'
  | 'whatsapp' | 'mega' | 'teacherLink' | 'studentLink' | 'students' | 'status' | 'studentCount';

/** Lezioni di un gruppo nuovo, come nel dialog di AdminGroups */
export const DEFAULT_GROUP_LESSONS = 32;

export const GROUP_COLUMNS: CsvColumn<GroupColumnKey>[] = [
  { key: 'id', header: 'ID', required: true, hint: 'Vuoto = gruppo nuovo. Non modificarlo per i gruppi esistenti.' },
  { key: 'title', header: 'Titolo', aliases: ['nome', 'gruppo'], required: true },
  { key: 'course', header: 'Corso', required: true, hint: 'Titolo del corso, come in Corsi.' },
  { key: 'teacher', header: 'Insegnante', aliases: ['email insegnante', 'docente'], hint: 'Email dell’insegnante.' },
  { key: 'startDate', header: 'Data inizio', aliases: ['inizio', 'data di inizio'], hint: 'gg/mm/aaaa.' },
  { key: 'days', header: 'Giorni', aliases: ['giorni lezione', 'giorno'], hint: 'Es. "Lun, Mer".' },
  { key: 'time', header: 'Ora', aliases: ['orario'], hint: 'hh:mm.' },
  { key: 'maxLessons', header: 'Numero lezioni', aliases: ['lezioni', 'max lezioni'], hint: `Vuoto = ${DEFAULT_GROUP_LESSONS} per i gruppi nuovi.` },
  { key: 'whatsapp', header: 'WhatsApp', aliases: ['link whatsapp'] },
  { key: 'mega', header: 'Chat Mega', aliases: ['mega', 'link mega'] },
  { key: 'teacherLink', header: 'Link insegnante', aliases: ['meet insegnante'] },
  { key: 'studentLink', header: 'Link studenti', aliases: ['meet studenti'] },
  { key: 'students', header: 'Studenti', aliases: ['username studenti', 'alunni'], hint: 'Username separati da virgola: quelli mancanti vengono aggiunti, nessuno viene tolto.' },
  { key: 'status', header: 'Stato', readOnly: true },
  { key: 'studentCount', header: 'Numero studenti', readOnly: true },
];

export interface CsvGroup {
  id: string;
  title: string;
  course_id: string;
  teacher_id: string | null;
  start_date: string | null;
  lesson_days: number[] | null;
  lesson_time: string | null;
  max_lessons: number | null;
  whatsapp_link: string | null;
  mega_chat_link: string | null;
  teacher_meeting_link: string | null;
  student_meeting_link: string | null;
  status: string;
}

export interface GroupsCsvContext {
  groups: CsvGroup[];
  courses: CourseRef[];
  teachers: { id: string; full_name: string; email: string | null }[];
  students: { id: string; full_name: string; username: string | null }[];
  members: { group_id: string; student_id: string }[];
}

type GroupFields = Pick<
  TablesInsert<'student_groups'>,
  | 'title' | 'course_id' | 'teacher_id' | 'start_date' | 'lesson_days' | 'lesson_time' | 'max_lessons'
  | 'whatsapp_link' | 'mega_chat_link' | 'teacher_meeting_link' | 'student_meeting_link'
>;

export interface GroupImport {
  /** null = gruppo nuovo */
  id: string | null;
  /** Gruppo nuovo: tutti i campi. Esistente: solo quelli cambiati. */
  fields: Partial<GroupFields>;
  addStudents: { id: string; username: string }[];
}

export async function loadGroupsCsvContext(): Promise<GroupsCsvContext> {
  const [groups, courses, roles, students, members] = await Promise.all([
    supabase
      .from('student_groups')
      .select('id, title, course_id, teacher_id, start_date, lesson_days, lesson_time, max_lessons, whatsapp_link, mega_chat_link, teacher_meeting_link, student_meeting_link, status')
      .order('created_at', { ascending: false }),
    supabase.from('courses').select('id, title, slug'),
    supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
    supabase.from('profiles').select('id, full_name, username').eq('role', 'student'),
    supabase.from('group_students').select('group_id, student_id'),
  ]);
  const failed = [groups, courses, roles, students, members].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const teacherIds = (roles.data ?? []).map((r) => r.user_id);
  const teachers = teacherIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', teacherIds)
    : { data: [], error: null };
  if (teachers.error) throw new Error(teachers.error.message);

  return {
    groups: groups.data ?? [],
    courses: courses.data ?? [],
    teachers: teachers.data ?? [],
    students: students.data ?? [],
    members: members.data ?? [],
  };
}

const headers = GROUP_COLUMNS.map((c) => c.header);

export function groupsToCsv(ctx: GroupsCsvContext): string {
  const course = new Map(ctx.courses.map((c) => [c.id, c.title]));
  const teacher = new Map(ctx.teachers.map((t) => [t.id, t.email || t.full_name]));
  const username = new Map(ctx.students.map((s) => [s.id, s.username]));
  const rows = ctx.groups.map((g) => {
    const ids = ctx.members.filter((m) => m.group_id === g.id).map((m) => m.student_id);
    const usernames = ids.map((id) => username.get(id)).filter((u): u is string => !!u).sort();
    return [
      g.id, g.title, course.get(g.course_id) ?? '', g.teacher_id ? teacher.get(g.teacher_id) ?? '' : '',
      formatItDate(g.start_date), formatDays(g.lesson_days), formatTime(g.lesson_time), g.max_lessons ?? '',
      g.whatsapp_link ?? '', g.mega_chat_link ?? '', g.teacher_meeting_link ?? '', g.student_meeting_link ?? '',
      usernames.join(', '), g.status === 'archived' ? 'Archiviato' : 'Attivo', ids.length,
    ];
  });
  return buildCsv(headers, rows);
}

export function groupsTemplateCsv(courseTitle = 'Python Base'): string {
  return buildCsv(headers, [[
    '', 'Python sabato mattina', courseTitle, 'insegnante@example.com', '10/01/2027', 'Sab', '10:00', DEFAULT_GROUP_LESSONS,
    '', '', '', '', 'mario_esempio, giulia_esempio', '', '',
  ]]);
}

export function planGroups(rows: string[][], ctx: GroupsCsvContext): CsvPlan<GroupImport> {
  const table = readTable(rows, GROUP_COLUMNS);
  const fileErrors = tableFileErrors(table);
  const plan: CsvPlan<GroupImport> = { rows: [], fileErrors, unknownColumns: table.unknown, ignoredColumns: table.ignored };
  if (fileErrors.length > 0) return plan;

  const groupById = new Map(ctx.groups.map((g) => [g.id, g]));
  const studentByUsername = new Map(
    ctx.students.filter((s) => s.username).map((s) => [s.username!.trim().toLowerCase(), s]),
  );
  const usernameById = new Map(ctx.students.map((s) => [s.id, s.username]));
  // Corso → studente → titolo del gruppo in cui è già (vincolo: un gruppo per corso)
  const placed = new Map<string, Map<string, string>>();
  const place = (courseId: string, studentId: string, title: string) => {
    if (!placed.has(courseId)) placed.set(courseId, new Map());
    placed.get(courseId)!.set(studentId, title);
  };
  for (const m of ctx.members) {
    const g = groupById.get(m.group_id);
    if (g) place(g.course_id, m.student_id, g.title);
  }
  const seenIds = new Map<string, number>();

  for (const { line, values: v } of table.records) {
    const row = new RowPlanBuilder<GroupImport>(line, v.title || '—');
    const fields: Partial<GroupFields> = {};

    let current: CsvGroup | undefined;
    if (v.id) {
      current = groupById.get(v.id);
      if (!current) row.error(`ID "${v.id}" non corrisponde a nessun gruppo: lascialo vuoto per crearne uno nuovo`);
      else if (seenIds.has(v.id)) row.error(`Gruppo già presente alla riga ${seenIds.get(v.id)}`);
      else seenIds.set(v.id, line);
    }

    if (!v.title) row.error('Titolo mancante');
    else fields.title = v.title;

    const course = v.course ? matchCourse(v.course, ctx.courses) : undefined;
    if (!v.course) row.error('Corso mancante');
    else if (!course) row.error(`Corso "${v.course}" non trovato`);
    else fields.course_id = course.id;

    if (table.present.has('teacher')) {
      if (!v.teacher) fields.teacher_id = null;
      else {
        const key = normalizeKey(v.teacher);
        const byEmail = EMAIL_RE.test(v.teacher) ? ctx.teachers.find((t) => t.email?.toLowerCase() === v.teacher!.toLowerCase()) : undefined;
        const byName = ctx.teachers.filter((t) => normalizeKey(t.full_name) === key);
        const teacher = byEmail ?? (byName.length === 1 ? byName[0] : undefined);
        if (!teacher) row.error(`Insegnante "${v.teacher}" non trovato (usa la sua email)`);
        else fields.teacher_id = teacher.id;
      }
    }

    if (table.present.has('startDate')) {
      const d = parseItDate(v.startDate ?? '', 'Data inizio');
      if (!d.ok) row.error(d.error);
      else fields.start_date = d.value;
    }
    if (table.present.has('days')) {
      const d = parseDays(v.days ?? '', 'Giorni');
      if (!d.ok) row.error(d.error);
      else fields.lesson_days = d.value.length ? d.value : null;
    }
    if (table.present.has('time')) {
      const t = parseTimeCell(v.time ?? '', 'Ora');
      if (!t.ok) row.error(t.error);
      else fields.lesson_time = t.value;
    }
    if (table.present.has('maxLessons')) {
      const n = parseIntCell(v.maxLessons ?? '', 'Numero lezioni', { min: 1, max: 200 });
      if (!n.ok) row.error(n.error);
      else fields.max_lessons = n.value ?? (current ? null : DEFAULT_GROUP_LESSONS);
    }
    if (table.present.has('whatsapp')) fields.whatsapp_link = linkCell(row, v.whatsapp ?? '', 'WhatsApp');
    if (table.present.has('mega')) fields.mega_chat_link = linkCell(row, v.mega ?? '', 'Chat Mega');
    if (table.present.has('teacherLink')) fields.teacher_meeting_link = linkCell(row, v.teacherLink ?? '', 'Link insegnante');
    if (table.present.has('studentLink')) fields.student_meeting_link = linkCell(row, v.studentLink ?? '', 'Link studenti');

    // Studenti da aggiungere
    const addStudents: GroupImport['addStudents'] = [];
    if (table.present.has('students')) {
      const listed = parseList(v.students ?? '');
      const unknown = listed.filter((u) => !studentByUsername.has(u.toLowerCase()));
      if (unknown.length) row.error(`Studenti non trovati: ${unknown.join(', ')}`);
      const memberIds = new Set(current ? ctx.members.filter((m) => m.group_id === current!.id).map((m) => m.student_id) : []);
      const listedIds = new Set<string>();
      for (const u of listed) {
        const s = studentByUsername.get(u.toLowerCase());
        if (!s) continue;
        listedIds.add(s.id);
        if (memberIds.has(s.id)) continue;
        const elsewhere = course ? placed.get(course.id)?.get(s.id) : undefined;
        if (elsewhere) row.error(`${s.username} è già nel gruppo "${elsewhere}" dello stesso corso`);
        else addStudents.push({ id: s.id, username: s.username! });
      }
      const kept = [...memberIds].filter((id) => !listedIds.has(id)).map((id) => usernameById.get(id)).filter(Boolean);
      if (kept.length) row.warn(`Restano nel gruppo anche se non sono nel file: ${kept.join(', ')}`);
    }

    if (!current) {
      fields.max_lessons ??= DEFAULT_GROUP_LESSONS;
      row.change('Nuovo gruppo');
      if (fields.start_date && fields.lesson_days?.length) {
        row.change(`Calendario di ${fields.max_lessons} lezioni generato in automatico, saltando le chiusure`);
      } else {
        row.warn('Senza data di inizio e giorni il calendario delle lezioni non viene generato');
      }
    }
    // ID vuoto ma titolo e corso di un gruppo esistente: probabilmente un doppione
    if (!current && !v.id && fields.course_id) {
      const same = ctx.groups.find((g) => g.course_id === fields.course_id && normalizeKey(g.title) === normalizeKey(v.title ?? ''));
      if (same) row.warn(`Esiste già un gruppo "${same.title}" in questo corso: con l'ID vuoto ne viene creato un altro`);
    }
    const addedText = `Studenti aggiunti: ${addStudents.map((s) => s.username).join(', ')}`;

    if (row.errors.length === 0 && course) {
      for (const s of addStudents) place(course.id, s.id, fields.title ?? current?.title ?? '');
    }

    if (!current) {
      if (addStudents.length) row.change(addedText);
      plan.rows.push(row.build(true, { id: null, fields, addStudents }));
      continue;
    }

    const changed: Partial<GroupFields> = {};
    const compare = <F extends keyof GroupFields>(field: F, label: string, before: unknown, after: unknown = fields[field]) => {
      if (!(field in fields)) return;
      if (row.diff(label, before, after)) changed[field] = fields[field];
    };
    const courseTitle = (id: string | null | undefined) => ctx.courses.find((c) => c.id === id)?.title ?? '';
    const teacherLabel = (id: string | null | undefined) => {
      const t = ctx.teachers.find((x) => x.id === id);
      return t ? t.email || t.full_name : '';
    };
    compare('title', 'Titolo', current.title);
    compare('course_id', 'Corso', courseTitle(current.course_id), courseTitle(fields.course_id));
    compare('teacher_id', 'Insegnante', teacherLabel(current.teacher_id), teacherLabel(fields.teacher_id));
    compare('start_date', 'Data inizio', formatItDate(current.start_date), formatItDate(fields.start_date));
    compare('lesson_days', 'Giorni', formatDays(current.lesson_days), formatDays(fields.lesson_days));
    compare('lesson_time', 'Ora', formatTime(current.lesson_time), formatTime(fields.lesson_time));
    compare('max_lessons', 'Numero lezioni', current.max_lessons, fields.max_lessons);
    compare('whatsapp_link', 'WhatsApp', current.whatsapp_link);
    compare('mega_chat_link', 'Chat Mega', current.mega_chat_link);
    compare('teacher_meeting_link', 'Link insegnante', current.teacher_meeting_link);
    compare('student_meeting_link', 'Link studenti', current.student_meeting_link);
    if (addStudents.length) row.change(addedText);
    if (['start_date', 'lesson_days', 'lesson_time', 'max_lessons'].some((f) => f in changed)) {
      row.warn('Il calendario già creato non cambia: aggiorna le date da "Calendario" del gruppo');
    }
    plan.rows.push(row.build(false, { id: current.id, fields: changed, addStudents }));
  }
  return plan;
}

export async function applyGroups(rows: readonly RowPlan<GroupImport>[], onProgress: ApplyProgress): Promise<ApplyResult[]> {
  const todo = rowsToApply(rows);
  const results: ApplyResult[] = [];
  for (const [i, r] of todo.entries()) {
    const { fields, addStudents } = r.data;
    let groupId = r.data.id;
    let message: string | undefined;
    if (!groupId) {
      const { data, error } = await supabase
        .from('student_groups')
        .insert({ ...fields, title: fields.title ?? '', course_id: fields.course_id ?? '' })
        .select('id')
        .single();
      if (error) message = error.message;
      else groupId = data.id;
    } else if (Object.keys(fields).length > 0) {
      const { error } = await supabase.from('student_groups').update(fields).eq('id', groupId);
      if (error) message = error.message;
    }
    if (groupId && !message) {
      // Uno alla volta: il trigger check_student_course_uniqueness spiega chi non entra
      const failed: string[] = [];
      for (const s of addStudents) {
        const { error } = await supabase.from('group_students').insert({ group_id: groupId, student_id: s.id });
        if (error) failed.push(`${s.username}: ${error.message}`);
      }
      if (failed.length) message = `${r.data.id ? 'Gruppo aggiornato' : 'Gruppo creato'}, ma non sono entrati: ${failed.join('; ')}`;
    }
    results.push({ line: r.line, key: r.key, ok: !message, message });
    onProgress(i + 1, todo.length);
  }
  return results;
}

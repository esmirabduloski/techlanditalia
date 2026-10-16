/**
 * Stato di compiti e presenze di un figlio, come lo vede il genitore.
 *
 * Funzioni pure condivise dalla scheda «In breve» e dalle sezioni Compiti e
 * Presenze dell'area genitore, così i numeri del riepilogo e quelli del
 * dettaglio coincidono sempre. Le date sono stringhe "YYYY-MM-DD" (come
 * group_lesson_schedule.lesson_date) confrontate con la data locale di oggi:
 * `new Date("2026-10-16")` è la mezzanotte UTC e farebbe sembrare "passata"
 * una lezione di oggi pomeriggio.
 */

export type HomeworkComputedStatus = 'pending' | 'submitted' | 'graded' | 'missing' | 'none';
export type AttendanceComputedStatus = 'present' | 'absent' | 'justified' | 'pending';

/** Data locale "YYYY-MM-DD". */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Prime 10 cifre di una data o di un timestamp ISO. */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

/**
 * Un compito è "mancante" solo quando la scadenza è passata senza consegna.
 * Scadenza = quella del gruppo, altrimenti la lezione successiva; se non c'è
 * nessuna delle due vale la data della lezione stessa.
 */
export function homeworkStatus(input: {
  hasHomework: boolean;
  submission?: { status: string | null } | null;
  lessonDate?: string | null;
  dueDate?: string | null;
  today?: string;
}): HomeworkComputedStatus {
  if (!input.hasHomework) return 'none';
  if (input.submission) return input.submission.status === 'graded' ? 'graded' : 'submitted';
  const today = input.today ?? localDateKey();
  const deadline = input.dueDate ?? input.lessonDate;
  if (deadline && dayOf(deadline) < today) return 'missing';
  return 'pending';
}

/** Presenza registrata dall'insegnante; una lezione passata senza registro conta come assenza. */
export function attendanceStatus(
  recorded: string | null | undefined,
  lessonDate: string,
  today: string = localDateKey(),
): AttendanceComputedStatus {
  if (recorded === 'present') return 'present';
  if (recorded === 'absent') return 'absent';
  if (recorded === 'justified' || recorded === 'excused') return 'justified';
  return dayOf(lessonDate) < today ? 'absent' : 'pending';
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  justified: number;
  /** Presenze sul totale delle lezioni già svolte (giustificate comprese nel totale). */
  percentage: number;
}

export function attendanceStats(statuses: AttendanceComputedStatus[]): AttendanceStats {
  const present = statuses.filter((s) => s === 'present').length;
  const absent = statuses.filter((s) => s === 'absent').length;
  const justified = statuses.filter((s) => s === 'justified').length;
  const total = present + absent + justified;
  return { total, present, absent, justified, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
}

export interface HomeworkCounts {
  all: number;
  pending: number;
  submitted: number;
  graded: number;
  missing: number;
}

export function homeworkCounts(statuses: HomeworkComputedStatus[]): HomeworkCounts {
  const count = (s: HomeworkComputedStatus) => statuses.filter((x) => x === s).length;
  return {
    all: statuses.filter((s) => s !== 'none').length,
    pending: count('pending'),
    submitted: count('submitted'),
    graded: count('graded'),
    missing: count('missing'),
  };
}

/** Prima lezione di oggi o futura, in ordine di data. */
export function nextLesson<T extends { lesson_date: string }>(lessons: T[], today: string = localDateKey()): T | null {
  return (
    [...lessons]
      .filter((l) => dayOf(l.lesson_date) >= today)
      .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date))[0] ?? null
  );
}

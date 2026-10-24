/**
 * Linea del tempo dei progressi di un figlio, come la vede il genitore.
 *
 * Funzioni pure: trasformano presenze, compiti, esercizi, badge, serie,
 * competenze confermate e attestati in traguardi datati, dal primo giorno a
 * oggi. Non segue il corso scelto: il percorso si somma tra un corso e l'altro.
 * Le date sono giorni locali "YYYY-MM-DD"; i timestamp vengono convertiti
 * nell'ora locale, così un compito consegnato alle 00:30 conta nel giorno giusto.
 */
import { localDateKey } from '@/lib/childProgress';
import { levelInfo, type SkillMapEntry } from '@/lib/skillMap';

export type TimelineKind =
  | 'start'
  | 'course'
  | 'lessons'
  | 'exercises'
  | 'homework'
  | 'perfect'
  | 'streak'
  | 'skill'
  | 'badge'
  | 'certificate';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** Giorno locale "YYYY-MM-DD". */
  date: string;
  emoji: string;
  title: string;
  detail: string | null;
}

/** Lezione con presenza registrata; il corso manca se il figlio non è più nel gruppo. */
export interface TimelineAttendance {
  date: string;
  courseId: string | null;
  courseTitle: string | null;
  courseEmoji: string | null;
}

export interface TimelineSubmission {
  submittedAt: string;
  feedbackAt: string | null;
  grade: number | null;
  title: string | null;
}

export interface TimelineBadge {
  badgeId: string;
  earnedAt: string;
  name: string;
  emoji: string;
  description: string | null;
}

export interface TimelineStreakBonus {
  awardedAt: string | null;
  type: string;
  milestone: number;
  points: number;
}

/** Quello che arriva dal database (vedi useChildTimeline). */
export interface TimelineSources {
  attendance: TimelineAttendance[];
  submissions: TimelineSubmission[];
  /** completed_at degli esercizi risolti. */
  exercises: string[];
  badges: TimelineBadge[];
  streakBonuses: TimelineStreakBonus[];
}

export interface TimelineCertificate {
  id: string;
  issued_on: string;
  course_title: string;
  course_emoji: string | null;
  lessons_attended: number;
}

export interface TimelineInput extends TimelineSources {
  firstName: string;
  /** Creazione del profilo: il primo giorno, se viene prima di ogni traguardo. */
  createdAt?: string | null;
  certificates: TimelineCertificate[];
  skills: SkillMapEntry[];
}

/** Soglie festeggiate per lezioni, compiti ed esercizi (la prima volta ha il suo traguardo). */
export const COUNT_MILESTONES = [10, 25, 50, 100, 200, 300, 500, 1000];

/** Stesso giorno: in cima il traguardo più importante (l'elenco va dal più recente). */
const KIND_RANK: Record<TimelineKind, number> = {
  certificate: 9,
  badge: 8,
  skill: 7,
  streak: 6,
  perfect: 5,
  homework: 4,
  exercises: 3,
  lessons: 2,
  course: 1,
  start: 0,
};

/** Giorno locale di una data "YYYY-MM-DD" o di un timestamp ISO; null se non è una data. */
export function dayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}

function sortedDays(values: (string | null | undefined)[]): string[] {
  return values.map(dayKey).filter((d): d is string => !!d).sort();
}

/** Un traguardo per ogni soglia raggiunta, nel giorno in cui è stata superata. */
function countEvents(days: string[], make: (n: number, date: string) => TimelineEvent): TimelineEvent[] {
  return COUNT_MILESTONES.filter((n) => n <= days.length).map((n) => make(n, days[n - 1]));
}

/** Traguardi dal più recente al primo giorno. */
export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Lezioni: la prima di ogni corso, poi le soglie su tutte le lezioni
  const attendance = input.attendance
    .map((a) => ({ ...a, day: dayKey(a.date) }))
    .filter((a): a is TimelineAttendance & { day: string } => !!a.day)
    .sort((a, b) => a.day.localeCompare(b.day));
  const startedCourses = new Set<string>();
  attendance.forEach((a, index) => {
    if (!a.courseId || startedCourses.has(a.courseId)) return;
    startedCourses.add(a.courseId);
    events.push({
      id: `course-${a.courseId}`,
      kind: 'course',
      date: a.day,
      emoji: a.courseEmoji || '🎒',
      title: `Prima lezione di ${a.courseTitle ?? 'un nuovo corso'}`,
      detail: index === 0 ? 'La prima lezione in assoluto su TechLand' : 'Inizia un nuovo corso',
    });
  });
  events.push(...countEvents(attendance.map((a) => a.day), (n, date) => ({
    id: `lessons-${n}`,
    kind: 'lessons',
    date,
    emoji: '📚',
    title: `${n} lezioni frequentate`,
    detail: null,
  })));

  // Compiti: il primo, le soglie e il primo voto pieno
  const submissions = input.submissions
    .map((s) => ({ ...s, day: dayKey(s.submittedAt) }))
    .filter((s): s is TimelineSubmission & { day: string } => !!s.day)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (submissions[0]) {
    events.push({
      id: 'homework-1',
      kind: 'homework',
      date: submissions[0].day,
      emoji: '📝',
      title: 'Primo compito consegnato',
      detail: submissions[0].title,
    });
  }
  events.push(...countEvents(submissions.map((s) => s.day), (n, date) => ({
    id: `homework-${n}`,
    kind: 'homework',
    date,
    emoji: '📝',
    title: `${n} compiti consegnati`,
    detail: null,
  })));
  // Il voto arriva con la correzione: conta il giorno del commento, se c'è
  const perfect = submissions
    .filter((s) => (s.grade ?? 0) >= 100)
    .map((s) => ({ ...s, gradedDay: dayKey(s.feedbackAt) ?? s.day }))
    .sort((a, b) => a.gradedDay.localeCompare(b.gradedDay))[0];
  if (perfect) {
    events.push({
      id: 'perfect-1',
      kind: 'perfect',
      date: perfect.gradedDay,
      emoji: '💯',
      title: 'Primo compito da 100%',
      detail: perfect.title,
    });
  }

  // Esercizi di coding risolti sulla piattaforma
  const exercises = sortedDays(input.exercises);
  if (exercises[0]) {
    events.push({ id: 'exercises-1', kind: 'exercises', date: exercises[0], emoji: '💻', title: 'Primo esercizio di coding risolto', detail: null });
  }
  events.push(...countEvents(exercises, (n, date) => ({
    id: `exercises-${n}`,
    kind: 'exercises',
    date,
    emoji: '💻',
    title: `${n} esercizi risolti`,
    detail: null,
  })));

  input.badges.forEach((b) => {
    const date = dayKey(b.earnedAt);
    if (!date) return;
    events.push({
      id: `badge-${b.badgeId}`,
      kind: 'badge',
      date,
      emoji: b.emoji || '🏅',
      title: `Badge «${b.name}»`,
      detail: b.description?.trim() || null,
    });
  });

  input.streakBonuses.forEach((s) => {
    const date = dayKey(s.awardedAt);
    if (!date) return;
    const what = s.type === 'attendance' ? 'presenze' : 'compiti consegnati';
    events.push({
      id: `streak-${s.type}-${s.milestone}`,
      kind: 'streak',
      date,
      emoji: '🔥',
      title: `${s.milestone} ${what} di fila`,
      detail: s.points > 0 ? `+${s.points} punti bonus` : null,
    });
  });

  // Competenze: solo i livelli confermati dall'insegnante hanno una data
  input.skills.forEach((entry) => {
    const date = entry.confirmed && entry.level > 0 ? dayKey(entry.evidence?.assessed_at) : null;
    if (!date) return;
    const by = entry.evidence?.assessed_by_name;
    events.push({
      id: `skill-${entry.concept.id}`,
      kind: 'skill',
      date,
      emoji: entry.concept.emoji,
      title: `${entry.concept.label}: livello ${levelInfo(entry.level).label}`,
      detail: by ? `Confermato da ${by}` : "Confermato dall'insegnante",
    });
  });

  input.certificates.forEach((c) => {
    events.push({
      id: `certificate-${c.id}`,
      kind: 'certificate',
      date: c.issued_on,
      emoji: '🎓',
      title: 'Attestato di fine corso',
      detail: `${c.course_emoji ? `${c.course_emoji} ` : ''}${c.course_title} · ${c.lessons_attended} ${c.lessons_attended === 1 ? 'lezione' : 'lezioni'}`,
    });
  });

  // Il primo giorno: la creazione del profilo, o la prima attività se viene prima
  // (anche una lezione di un gruppo lasciato, che non apre un corso)
  const firstDay = sortedDays([input.createdAt, attendance[0]?.day, ...events.map((e) => e.date)])[0];
  if (firstDay) {
    events.push({
      id: 'start',
      kind: 'start',
      date: firstDay,
      emoji: '🚀',
      title: 'Primo giorno su TechLand',
      detail: `Inizia il percorso di ${input.firstName}`,
    });
  }

  return events.sort((a, b) => b.date.localeCompare(a.date) || KIND_RANK[b.kind] - KIND_RANK[a.kind]);
}

export interface TimelineMonth {
  /** "YYYY-MM". */
  month: string;
  events: TimelineEvent[];
}

/** Raggruppa per mese mantenendo l'ordine dell'elenco. */
export function groupByMonth(events: TimelineEvent[]): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  for (const event of events) {
    const month = event.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.events.push(event);
    else months.push({ month, events: [event] });
  }
  return months;
}

export interface TimelineSummary {
  /** Primo giorno, se c'è. */
  since: string | null;
  lessons: number;
  homework: number;
  exercises: number;
  badges: number;
  certificates: number;
}

/** I numeri in cima alla linea del tempo, dalle stesse fonti dei traguardi. */
export function timelineSummary(input: TimelineInput, events: TimelineEvent[]): TimelineSummary {
  return {
    since: events.find((e) => e.kind === 'start')?.date ?? null,
    lessons: input.attendance.filter((a) => dayKey(a.date)).length,
    homework: input.submissions.length,
    exercises: input.exercises.length,
    badges: input.badges.length,
    certificates: input.certificates.length,
  };
}

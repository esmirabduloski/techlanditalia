import { describe, expect, it } from 'vitest';
import { buildTimeline, dayKey, groupByMonth, timelineSummary, type TimelineInput } from './childTimeline';
import { SKILL_CONCEPTS, type SkillMapEntry } from './skillMap';

const python = { courseId: 'c-python', courseTitle: 'Python Base', courseEmoji: '🐍' };
const scratch = { courseId: 'c-scratch', courseTitle: 'Scratch', courseEmoji: '🐱' };

function input(overrides: Partial<TimelineInput> = {}): TimelineInput {
  return {
    firstName: 'Luca',
    createdAt: null,
    attendance: [],
    submissions: [],
    exercises: [],
    badges: [],
    streakBonuses: [],
    certificates: [],
    skills: [],
    ...overrides,
  };
}

/** n lezioni settimanali dal 2026-01-05. */
function weekly(n: number, course = python) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 5 + i * 7));
    return { date: d.toISOString().slice(0, 10), ...course };
  });
}

const ids = (events: { id: string }[]) => events.map((e) => e.id);

describe('dayKey', () => {
  it('lascia le date e converte i timestamp nel giorno locale', () => {
    expect(dayKey('2026-03-04')).toBe('2026-03-04');
    const ts = '2026-03-04T10:00:00Z';
    const local = new Date(ts);
    expect(dayKey(ts)).toBe(`${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`);
    expect(dayKey(null)).toBeNull();
    expect(dayKey('non è una data')).toBeNull();
  });
});

describe('buildTimeline', () => {
  it('senza dati e senza profilo non ci sono traguardi', () => {
    expect(buildTimeline(input())).toEqual([]);
  });

  it('il primo giorno è la creazione del profilo', () => {
    const events = buildTimeline(input({ createdAt: '2025-09-01' }));
    expect(events).toEqual([
      { id: 'start', kind: 'start', date: '2025-09-01', emoji: '🚀', title: 'Primo giorno su TechLand', detail: 'Inizia il percorso di Luca' },
    ]);
  });

  it('il primo giorno non viene mai dopo il primo traguardo', () => {
    const events = buildTimeline(input({ createdAt: '2026-02-01', attendance: weekly(1) }));
    expect(events.at(-1)).toMatchObject({ kind: 'start', date: '2026-01-05' });
  });

  it('prima lezione di ogni corso e soglie su tutte le lezioni', () => {
    const attendance = [...weekly(8), ...weekly(3, scratch).map((a) => ({ ...a, date: a.date.replace('2026-01', '2026-02') }))];
    const events = buildTimeline(input({ attendance }));
    const courses = events.filter((e) => e.kind === 'course');
    expect(courses.map((e) => [e.title, e.date, e.detail])).toEqual([
      ['Prima lezione di Scratch', '2026-02-05', 'Inizia un nuovo corso'],
      ['Prima lezione di Python Base', '2026-01-05', 'La prima lezione in assoluto su TechLand'],
    ]);
    expect(courses[0].emoji).toBe('🐱');
    // Le soglie contano le lezioni di tutti i corsi in ordine di data: la decima è Scratch del 19 febbraio
    expect(events.find((e) => e.id === 'lessons-10')).toMatchObject({ date: '2026-02-19', title: '10 lezioni frequentate' });
    expect(events.find((e) => e.id === 'lessons-25')).toBeUndefined();
  });

  it('le lezioni di un gruppo lasciato contano ma non aprono un corso', () => {
    const events = buildTimeline(input({ attendance: [{ date: '2026-01-05', courseId: null, courseTitle: null, courseEmoji: null }] }));
    expect(ids(events)).toEqual(['start']);
    expect(timelineSummary(input({ attendance: [{ date: '2026-01-05', courseId: null, courseTitle: null, courseEmoji: null }] }), events).lessons).toBe(1);
  });

  it('compiti: primo, soglie e primo 100% nel giorno della correzione', () => {
    const submissions = Array.from({ length: 10 }, (_, i) => ({
      submittedAt: `2026-01-${String(i + 10).padStart(2, '0')}`,
      feedbackAt: i === 3 ? '2026-01-20' : null,
      grade: i === 3 || i === 7 ? 100 : 80,
      title: `Compito ${i + 1}`,
    }));
    const events = buildTimeline(input({ submissions }));
    expect(events.find((e) => e.id === 'homework-1')).toMatchObject({ date: '2026-01-10', title: 'Primo compito consegnato', detail: 'Compito 1' });
    expect(events.find((e) => e.id === 'homework-10')).toMatchObject({ date: '2026-01-19', title: '10 compiti consegnati' });
    // Il compito 8 è consegnato il 17 senza commento: il suo 100% arriva prima di quello del compito 4 (corretto il 20)
    expect(events.find((e) => e.id === 'perfect-1')).toMatchObject({ date: '2026-01-17', detail: 'Compito 8' });
  });

  it('esercizi, badge, serie, competenze confermate e attestati', () => {
    const variabili = SKILL_CONCEPTS.find((c) => c.id === 'variabili')!;
    const cicli = SKILL_CONCEPTS.find((c) => c.id === 'cicli')!;
    const evidence = (assessed_at: string | null) => ({
      concept: '', lessons_tagged: 1, lessons_met: 1, lessons_completed: 1, homework_scored: 0, homework_avg: null,
      last_activity: null, course_ids: [], teacher_level: 2, teacher_note: null, assessed_at, assessed_by_name: 'Marco Verdi',
    });
    const skills: SkillMapEntry[] = [
      { concept: variabili, level: 2, autoLevel: 1, confirmed: true, evidence: evidence('2026-03-01T09:00:00Z') },
      // Calcolato in automatico: nessuna data, nessun traguardo
      { concept: cicli, level: 1, autoLevel: 1, confirmed: false, evidence: evidence(null) },
    ];
    const events = buildTimeline(input({
      exercises: Array.from({ length: 12 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}T15:00:00`),
      badges: [{ badgeId: 'b1', earnedAt: '2026-02-03T15:00:00', name: 'Prima lezione', emoji: '🎉', description: 'Hai seguito la tua prima lezione' }],
      streakBonuses: [
        { awardedAt: '2026-02-10T15:00:00', type: 'attendance', milestone: 7, points: 100 },
        { awardedAt: null, type: 'homework', milestone: 3, points: 0 },
      ],
      certificates: [{ id: 'cert1', issued_on: '2026-06-10', course_title: 'Python Base', course_emoji: '🐍', lessons_attended: 30 }],
      skills,
    }));
    // La serie senza data non compare; nello stesso giorno la serie sta sopra gli esercizi
    expect(events.map((e) => [e.id, e.date, e.title, e.detail])).toEqual([
      ['certificate-cert1', '2026-06-10', 'Attestato di fine corso', '🐍 Python Base · 30 lezioni'],
      ['skill-variabili', dayKey('2026-03-01T09:00:00Z'), 'Variabili: livello Intermedio', 'Confermato da Marco Verdi'],
      ['streak-attendance-7', '2026-02-10', '7 presenze di fila', '+100 punti bonus'],
      ['exercises-10', '2026-02-10', '10 esercizi risolti', null],
      ['badge-b1', '2026-02-03', 'Badge «Prima lezione»', 'Hai seguito la tua prima lezione'],
      ['exercises-1', '2026-02-01', 'Primo esercizio di coding risolto', null],
      ['start', '2026-02-01', 'Primo giorno su TechLand', 'Inizia il percorso di Luca'],
    ]);
  });

  it('nello stesso giorno il traguardo più importante sta sopra', () => {
    const events = buildTimeline(input({
      attendance: weekly(1),
      badges: [{ badgeId: 'b1', earnedAt: '2026-01-05', name: 'Prima lezione', emoji: '🎉', description: null }],
    }));
    expect(ids(events)).toEqual(['badge-b1', 'course-c-python', 'start']);
  });
});

describe('groupByMonth', () => {
  it('raggruppa per mese mantenendo l’ordine', () => {
    const events = buildTimeline(input({ createdAt: '2025-12-20', attendance: weekly(10) }));
    expect(groupByMonth(events).map((m) => [m.month, ids(m.events)])).toEqual([
      ['2026-03', ['lessons-10']],
      ['2026-01', ['course-c-python']],
      ['2025-12', ['start']],
    ]);
  });
});

describe('timelineSummary', () => {
  it('conta le fonti e prende il primo giorno', () => {
    const data = input({
      createdAt: '2025-12-20',
      attendance: weekly(3),
      submissions: [{ submittedAt: '2026-01-06', feedbackAt: null, grade: null, title: null }],
      exercises: ['2026-01-07T10:00:00'],
      badges: [{ badgeId: 'b1', earnedAt: '2026-01-05', name: 'x', emoji: '🎉', description: null }],
      certificates: [{ id: 'c', issued_on: '2026-06-01', course_title: 'Python', course_emoji: null, lessons_attended: 1 }],
    });
    expect(timelineSummary(data, buildTimeline(data))).toEqual({
      since: '2025-12-20', lessons: 3, homework: 1, exercises: 1, badges: 1, certificates: 1,
    });
  });
});

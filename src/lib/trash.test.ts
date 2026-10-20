import { describe, expect, it } from 'vitest';
import {
  batchContents,
  batchTitle,
  batchTypes,
  daysLeft,
  restoreErrorMessage,
  rowTitle,
  tableLabel,
} from './trash';

describe('tableLabel / rowTitle', () => {
  it('traduce le tabelle e lascia il nome tecnico se non la conosce', () => {
    expect(tableLabel('courses')).toBe('Corso');
    expect(tableLabel('homework_submissions', 3)).toBe('consegne');
    expect(tableLabel('tabella_nuova')).toBe('tabella_nuova');
  });

  it('prende il primo campo leggibile della riga', () => {
    expect(rowTitle({ title: '  Python base ', slug: 'python' })).toBe('Python base');
    expect(rowTitle({ term: 'Variabile' })).toBe('Variabile');
    expect(rowTitle({ parent_name: 'Mario Rossi', email: 'm@r.it' })).toBe('Mario Rossi');
    expect(rowTitle({ title: '', email: 'a@b.it' })).toBe('a@b.it');
    expect(rowTitle({ group_id: 'x', lesson_number: 3 })).toBeNull();
    expect(rowTitle(null)).toBeNull();
  });
});

describe('batchTitle / batchContents', () => {
  const course = {
    root_table: 'courses',
    root_data: { title: 'Python base' },
    counts: { courses: 1, lessons: 12, homework_submissions: 40, lesson_tasks: 12, enrollments: 5, student_groups: 2 },
  };

  it('nomina la riga del click', () => {
    expect(batchTitle(course)).toBe('Corso «Python base»');
    expect(batchTitle({ root_table: 'group_students', root_data: {}, counts: { group_students: 1 } })).toBe(
      'Alunno nel gruppo',
    );
  });

  it('conta le righe quando un click ne cancella tante', () => {
    expect(batchTitle({ root_table: 'group_attendance', root_data: {}, counts: { group_attendance: 30 } })).toBe(
      '30 presenze',
    );
  });

  it('riassume quello che è sparito insieme, dal più numeroso', () => {
    expect(batchContents(course)).toBe('40 consegne, 12 lezioni, 12 task, 5 iscrizioni ai corsi e altri 2 elementi');
    expect(batchContents({ root_table: 'lessons', counts: { lessons: 1, homework: 1 } })).toBe('1 compito');
    expect(batchContents({ root_table: 'glossary_terms', counts: { glossary_terms: 1 } })).toBeNull();
  });
});

describe('daysLeft', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('conta i giorni che restano sui 30', () => {
    expect(daysLeft('2026-10-20T11:00:00Z', now)).toBe(30);
    expect(daysLeft('2026-10-10T12:00:00Z', now)).toBe(20);
    expect(daysLeft('2026-09-20T13:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-09-01T12:00:00Z', now)).toBe(0);
  });
});

describe('batchTypes', () => {
  it('elenca i tipi una volta sola, in ordine alfabetico italiano', () => {
    expect(batchTypes([{ root_table: 'lessons' }, { root_table: 'courses' }, { root_table: 'lessons' }])).toEqual([
      'courses',
      'lessons',
    ]);
  });
});

describe('restoreErrorMessage', () => {
  it('spiega conflitti e genitori mancanti con il nome della riga', () => {
    expect(restoreErrorMessage({ message: 'trash_conflict', details: 'courses', hint: 'Python base' })).toBe(
      'Corso «Python base» esiste già con gli stessi dati (per esempio lo stesso slug o la stessa email). Rinomina o elimina quello nuovo e riprova.',
    );
    expect(restoreErrorMessage({ message: 'trash_missing_parent', details: 'lessons', hint: 'Lezione 1' })).toContain(
      'Lezione «Lezione 1» dipende da qualcosa che è stato eliminato a parte',
    );
  });

  it('gestisce batch spariti, tabelle mancanti e altri errori', () => {
    expect(restoreErrorMessage({ message: 'trash_not_found' })).toContain('Non è più nel cestino');
    expect(restoreErrorMessage({ message: 'trash_table_missing', details: 'vecchia' })).toContain('«vecchia»');
    expect(
      restoreErrorMessage({ message: 'trash_failed: null value in column "x"', details: 'homework', hint: 'Compito 1' }),
    ).toBe('Ripristino non riuscito (Compito «Compito 1»): null value in column "x"');
    expect(restoreErrorMessage({ message: 'permission denied' })).toBe('permission denied');
  });
});

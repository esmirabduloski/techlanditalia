import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { DEFAULT_GROUP_LESSONS, groupsTemplateCsv, groupsToCsv, planGroups, type CsvGroup, type GroupsCsvContext } from './groupsCsv';

const group = (id: string, extra: Partial<CsvGroup> = {}): CsvGroup => ({
  id,
  title: `Gruppo ${id}`,
  course_id: 'c-scratch',
  teacher_id: 't1',
  start_date: '2026-10-03',
  lesson_days: [6],
  lesson_time: '10:00:00',
  max_lessons: 32,
  whatsapp_link: null,
  mega_chat_link: null,
  teacher_meeting_link: 'https://meet.google.com/abc',
  student_meeting_link: null,
  status: 'active',
  ...extra,
});

const ctx = (): GroupsCsvContext => ({
  groups: [group('g1', { title: 'Scratch sabato' }), group('g2', { title: 'Python lunedì', course_id: 'c-python', lesson_days: [1] })],
  courses: [{ id: 'c-scratch', title: 'Scratch', slug: 'scratch-junior' }, { id: 'c-python', title: 'Python Base', slug: 'python' }],
  teachers: [{ id: 't1', full_name: 'Luca Verdi', email: 'luca@techland.test' }, { id: 't2', full_name: 'Sara Neri', email: 'sara@techland.test' }],
  students: [
    { id: 's1', full_name: 'Mario', username: 'mario' },
    { id: 's2', full_name: 'Giulia', username: 'giulia' },
    { id: 's3', full_name: 'Anna', username: 'anna' },
  ],
  members: [{ group_id: 'g1', student_id: 's1' }, { group_id: 'g2', student_id: 's3' }],
});

const HEAD = 'ID;Titolo;Corso;Insegnante;Data inizio;Giorni;Ora;Numero lezioni;Studenti';

describe('planGroups', () => {
  it("l'export reimportato così com'è non cambia niente", () => {
    const plan = planGroups(parseCsv(groupsToCsv(ctx())), ctx());
    expect(plan.fileErrors).toEqual([]);
    expect(plan.ignoredColumns).toEqual(['Stato', 'Numero studenti']);
    expect(plan.rows.map((r) => r.status)).toEqual(['same', 'same']);
  });

  it('gruppo nuovo con calendario automatico e studenti', () => {
    const csv = `${HEAD}\n;Scratch domenica;scratch;sara@techland.test;04/10/2026;Dom;9.30;;giulia`;
    const [row] = planGroups(parseCsv(csv), ctx()).rows;
    expect(row.status).toBe('new');
    expect(row.data).toEqual({
      id: null,
      fields: {
        title: 'Scratch domenica', course_id: 'c-scratch', teacher_id: 't2', start_date: '2026-10-04',
        lesson_days: [0], lesson_time: '09:30', max_lessons: DEFAULT_GROUP_LESSONS,
      },
      addStudents: [{ id: 's2', username: 'giulia' }],
    });
    expect(row.changes).toContain(`Calendario di ${DEFAULT_GROUP_LESSONS} lezioni generato in automatico, saltando le chiusure`);
  });

  it('gruppo esistente: solo i campi cambiati, studenti solo aggiunti, avviso sul calendario', () => {
    const csv = `${HEAD}\ng1;Scratch sabato;Scratch;luca@techland.test;03/10/2026;Sab, Dom;10:00;32;giulia`;
    const [row] = planGroups(parseCsv(csv), ctx()).rows;
    expect(row.status).toBe('update');
    expect(row.data).toEqual({ id: 'g1', fields: { lesson_days: [0, 6] }, addStudents: [{ id: 's2', username: 'giulia' }] });
    expect(row.changes).toEqual(['Giorni: "Sab" → "Sab, Dom"', 'Studenti aggiunti: giulia']);
    expect(row.warnings).toEqual([
      'Restano nel gruppo anche se non sono nel file: mario',
      'Il calendario già creato non cambia: aggiorna le date da "Calendario" del gruppo',
    ]);
  });

  it('un insegnante vuoto toglie l’insegnante, una colonna assente no', () => {
    const empty = planGroups(parseCsv(`ID;Titolo;Corso;Insegnante\ng1;Scratch sabato;Scratch;`), ctx()).rows[0];
    expect(empty.data?.fields).toEqual({ teacher_id: null });
    const absent = planGroups(parseCsv(`ID;Titolo;Corso\ng1;Scratch sabato;Scratch`), ctx()).rows[0];
    expect(absent.status).toBe('same');
  });

  it('errori: ID sconosciuto, corso, insegnante, studenti e un gruppo per corso', () => {
    const csv = [
      HEAD,
      'zzz;X;Scratch;;;;;;',
      ';Y;Robotica;;;;;;',
      ';Z;Scratch;nessuno@x.it;;;;;',
      ';W;Scratch;;;;;;mario, pippo',
      ';V;Python Base;;;;;;giulia',
      ';U;Python Base;;;;;;giulia',
    ].join('\n');
    const rows = planGroups(parseCsv(csv), ctx()).rows;
    expect(rows[0].errors[0]).toMatch(/ID "zzz" non corrisponde/);
    expect(rows[1].errors).toEqual(['Corso "Robotica" non trovato']);
    expect(rows[2].errors).toEqual(['Insegnante "nessuno@x.it" non trovato (usa la sua email)']);
    expect(rows[3].errors).toEqual(['Studenti non trovati: pippo', 'mario è già nel gruppo "Scratch sabato" dello stesso corso']);
    // giulia entra in V; la riga dopo la vorrebbe in un altro gruppo dello stesso corso
    expect(rows[4].status).toBe('new');
    expect(rows[5].errors).toEqual(['giulia è già nel gruppo "V" dello stesso corso']);
  });

  it('avvisa se un gruppo nuovo ha lo stesso titolo di uno esistente', () => {
    const [row] = planGroups(parseCsv(`ID;Titolo;Corso\n;scratch sabato;Scratch`), ctx()).rows;
    expect(row.status).toBe('new');
    expect(row.warnings).toContain('Esiste già un gruppo "Scratch sabato" in questo corso: con l\'ID vuoto ne viene creato un altro');
    expect(row.warnings).toContain('Senza data di inizio e giorni il calendario delle lezioni non viene generato');
  });

  it('il modello è importabile', () => {
    const c = ctx();
    c.students.push({ id: 's4', full_name: 'ME', username: 'mario_esempio' }, { id: 's5', full_name: 'GE', username: 'giulia_esempio' });
    c.teachers.push({ id: 't3', full_name: 'Esempio', email: 'insegnante@example.com' });
    const plan = planGroups(parseCsv(groupsTemplateCsv('Scratch')), c);
    expect(plan.rows.map((r) => [r.status, r.errors])).toEqual([['new', []]]);
  });
});

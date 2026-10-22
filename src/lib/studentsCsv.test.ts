import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import {
  batchCreations, planStudents, sanitizeUsername, STUDENT_IMPORT_BATCH, studentsTemplateCsv, studentsToCsv,
  type StudentsCsvContext,
} from './studentsCsv';
import {
  checkImportRow, sanitizeUsername as serverSanitize, STUDENT_IMPORT_BATCH_MAX,
} from '../../supabase/functions/_shared/studentimport';

const ctx = (): StudentsCsvContext => ({
  profiles: [
    { id: 'p1', full_name: 'Anna Rossi', role: 'parent', parent_id: null, email: 'anna@x.it', username: null },
    { id: 's1', full_name: 'Mario Rossi', role: 'student', parent_id: 'p1', email: 'mario_1@student.techland.local', username: 'mario_rossi' },
    { id: 's2', full_name: 'Vecchio Utente', role: 'student', parent_id: null, email: null, username: 'Vecchio.Utente' },
    { id: 't1', full_name: 'Luca Verdi', role: 'teacher', parent_id: null, email: 'luca@x.it', username: 'luca' },
  ],
  courses: [{ id: 'c1', title: 'Scratch', slug: 'scratch' }, { id: 'c2', title: 'Python Base', slug: 'python' }],
  enrollments: [{ student_id: 's1', course_id: 'c1', status: 'active' }],
  groups: [{ id: 'g1', title: 'Scratch sabato', status: 'active' }],
  members: [{ group_id: 'g1', student_id: 's1' }],
});

const HEAD = 'Username;Nome studente;Nome genitore;Email genitore;Corsi';

describe('planStudents', () => {
  it("l'export reimportato così com'è non cambia niente", () => {
    const csv = studentsToCsv(ctx());
    expect(parseCsv(csv)[1]).toEqual(['mario_rossi', 'Mario Rossi', 'Anna Rossi', 'anna@x.it', 'Scratch', 'Scratch sabato']);
    const plan = planStudents(parseCsv(csv), ctx());
    expect(plan.ignoredColumns).toEqual(['Gruppi']);
    expect(plan.rows.map((r) => [r.key, r.status])).toEqual([['mario_rossi', 'same'], ['Vecchio.Utente', 'same']]);
  });

  it('studente esistente: nomi aggiornati e iscrizioni solo aggiunte', () => {
    const csv = `${HEAD}\nMARIO_ROSSI;Mario Rossi Bianchi;Anna Maria Rossi;anna@x.it;Python Base`;
    const [row] = planStudents(parseCsv(csv), ctx()).rows;
    expect(row.status).toBe('update');
    expect(row.data).toEqual({
      kind: 'update',
      studentId: 's1',
      studentName: 'Mario Rossi Bianchi',
      parentRename: { id: 'p1', name: 'Anna Maria Rossi' },
      addCourseIds: ['c2'],
    });
    expect(row.warnings).toEqual(['Resta iscritto anche a: Scratch']);
  });

  it('il genitore non si cambia da CSV', () => {
    const csv = `${HEAD}\nmario_rossi;Mario Rossi;Altro;altro@x.it;`;
    const [row] = planStudents(parseCsv(csv), ctx()).rows;
    expect(row.errors[0]).toMatch(/Il genitore nel file \(altro@x.it\) non è quello collegato/);
  });

  it('nuovi studenti: figlio di un genitore esistente e fratelli sotto un genitore nuovo', () => {
    const csv = [
      HEAD,
      'Giulia Rossi;Giulia Rossi;;ANNA@x.it;Scratch',
      'luigi;Luigi Bianchi;Carla Bianchi;carla@x.it;',
      'marta;Marta Bianchi;;carla@x.it;Scratch, Python Base',
    ].join('\n');
    const rows = planStudents(parseCsv(csv), ctx()).rows;
    expect(rows.map((r) => r.status)).toEqual(['new', 'new', 'new']);
    expect(rows[0].key).toBe('giulia_rossi');
    expect(rows[0].warnings).toEqual(['Username normalizzato in "giulia_rossi"']);
    expect(rows[0].data).toMatchObject({ kind: 'create', username: 'giulia_rossi', parentId: 'p1', parentEmail: 'anna@x.it', courseIds: ['c1'] });
    expect(rows[1].data).toMatchObject({ kind: 'create', parentId: null, parentName: 'Carla Bianchi' });
    expect(rows[2].data).toMatchObject({ kind: 'create', parentId: null, parentName: 'Carla Bianchi', courseIds: ['c1', 'c2'] });
    expect(rows[2].changes[0]).toBe('Nuovo studente, figlio del genitore nuovo della riga 3 (carla@x.it)');
  });

  it("l'username vecchio con punti e maiuscole si ritrova senza normalizzarlo", () => {
    const [row] = planStudents(parseCsv(`Username;Nome studente\nvecchio.utente;Nuovo Nome`), ctx()).rows;
    expect(row.data).toMatchObject({ kind: 'update', studentId: 's2', studentName: 'Nuovo Nome' });
  });

  it('errori per riga', () => {
    const csv = [
      HEAD,
      ';Senza username;Pia;a@x.it;',
      'nuovo1;Nuovo;;;',
      'nuovo2;Nuovo;;nuova@x.it;',
      'nuovo3;Nuovo;Luca;luca@x.it;',
      'nuovo4;Nuovo;Pia;pia@x;Robotica',
      'luca;Luca;;;',
      'nuovo5;Nuovo;Carla;carla@x.it;',
      'nuovo5;Doppio;Carla;carla@x.it;',
      'nuovo6;Nuovo;Carla B.;carla@x.it;',
    ].join('\n');
    const rows = planStudents(parseCsv(csv), ctx()).rows;
    expect(rows.map((r) => r.errors)).toEqual([
      ['Username mancante'],
      ['Per uno studente nuovo serve l’email del genitore'],
      ['Per un genitore nuovo serve il nome'],
      ["L'email luca@x.it è di un account che non è un genitore: collega lo studente da Utenti"],
      ['Email del genitore "pia@x" non valida', 'Corsi non trovati: Robotica'],
      ['"luca" è l\'username di un account che non è uno studente'],
      [],
      ['Username già presente alla riga 8'],
      ['Nome del genitore diverso dalla riga 8 ("Carla")'],
    ]);
  });

  it('il modello è importabile', () => {
    const plan = planStudents(parseCsv(studentsTemplateCsv('Scratch')), ctx());
    expect(plan.rows.map((r) => [r.status, r.errors])).toEqual([['new', []], ['new', []]]);
  });
});

describe('regole condivise con admin-import-students', () => {
  it('stessa normalizzazione degli username e stessa dimensione dei blocchi', () => {
    for (const raw of ['Mario Rossi', ' giulia.b ', 'ÈLISA_99', 'a  b\tc', '---']) {
      expect(sanitizeUsername(raw)).toBe(serverSanitize(raw));
    }
    expect(STUDENT_IMPORT_BATCH).toBe(STUDENT_IMPORT_BATCH_MAX);
  });

  it('il server accetta le righe preparate dal client e rifiuta quelle manomesse', () => {
    const ok = { line: 3, parentEmail: 'Anna@x.it', parentName: 'Anna', studentName: 'Mario', username: 'mario', courseIds: ['0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e'] };
    expect(checkImportRow(ok)).toEqual({ ok: true, row: { ...ok, parentEmail: 'anna@x.it' } });
    expect(checkImportRow({ ...ok, username: 'Mario Rossi' })).toEqual({ ok: false, line: 3, error: 'Username non normalizzato (atteso "mario_rossi")' });
    expect(checkImportRow({ ...ok, courseIds: ['drop table'] })).toMatchObject({ ok: false, error: 'Corsi non validi' });
    expect(checkImportRow({ ...ok, parentEmail: 'x' })).toMatchObject({ ok: false, error: 'Email del genitore non valida' });
  });
});

describe('batchCreations', () => {
  const row = (email: string, i: number) => ({ line: i, data: { parentEmail: email } });

  it('i fratelli restano nello stesso blocco', () => {
    const rows = [row('a', 1), row('b', 2), row('a', 3), row('c', 4), row('c', 5)];
    const batches = batchCreations(rows, 3);
    expect(batches.map((b) => b.map((r) => r.line))).toEqual([[1, 3, 2], [4, 5]]);
  });

  it('una famiglia più grande del blocco si divide', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row('a', i + 1));
    expect(batchCreations(rows, 2).map((b) => b.length)).toEqual([2, 2, 1]);
  });
});

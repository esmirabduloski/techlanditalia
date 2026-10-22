import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { DEFAULT_LESSON_POINTS, lessonsTemplateCsv, lessonsToCsv, planLessons, type CsvLesson } from './lessonsCsv';

const lesson = (n: number, extra: Partial<CsvLesson> = {}): CsvLesson => ({
  id: `l${n}`,
  lesson_number: n,
  title: `Lezione ${n}`,
  description: null,
  objective: null,
  points_reward: 50,
  video_url: null,
  slides_url: null,
  concepts: [],
  ...extra,
});

const existing = [
  lesson(1, { description: 'Si parte', objective: 'muovere il gatto', concepts: ['sequenze'] }),
  lesson(2, { video_url: 'https://youtu.be/x', points_reward: 30 }),
];

describe('planLessons', () => {
  it("l'export reimportato così com'è non cambia niente", () => {
    const plan = planLessons(parseCsv(lessonsToCsv(existing)), existing);
    expect(plan.fileErrors).toEqual([]);
    expect(plan.rows.map((r) => r.status)).toEqual(['same', 'same']);
  });

  it('aggiorna solo i campi cambiati e crea le lezioni nuove', () => {
    const csv = [
      'Numero;Titolo;Descrizione;Competenze',
      '1;Lezione 1;Si parte da zero;sequenze, Variabili',
      '3;Lezione nuova;;Grafica, animazioni e mondi 3D',
    ].join('\n');
    const plan = planLessons(parseCsv(csv), existing, { totalLessons: 2 });
    const [upd, created] = plan.rows;
    expect(upd.status).toBe('update');
    expect(upd.data?.fields).toEqual({ description: 'Si parte da zero', concepts: ['sequenze', 'variabili'] });
    expect(upd.changes).toEqual([
      'Descrizione: "Si parte" → "Si parte da zero"',
      'Competenze: "sequenze" → "sequenze, variabili"',
    ]);
    expect(created.status).toBe('new');
    // Colonne assenti (punti, link) non entrano nei campi: valgono i default
    expect(created.data).toEqual({
      id: null,
      lesson_number: 3,
      fields: { title: 'Lezione nuova', description: null, concepts: ['grafica'] },
    });
    expect(created.warnings[0]).toMatch(/Il corso prevede 2 lezioni/);
  });

  it('cella vuota svuota il campo, punti vuoti tornano al predefinito', () => {
    const csv = 'Numero;Titolo;Video;Punti\n2;Lezione 2;;';
    const [row] = planLessons(parseCsv(csv), existing).rows;
    expect(row.data?.fields).toEqual({ video_url: null, points_reward: DEFAULT_LESSON_POINTS });
  });

  it("l'obiettivo si salva senza \"Oggi imparerai a\"", () => {
    const csv = 'Numero;Titolo;Obiettivo\n1;Lezione 1;🎯 Oggi imparerai a muovere il gatto.';
    expect(planLessons(parseCsv(csv), existing).rows[0].status).toBe('same');
  });

  it('errori per riga', () => {
    const csv = [
      'Numero;Titolo;Competenze;Video',
      'x;Senza numero;;',
      '1;;;',
      '4;Doppia;;',
      '4;Doppia di nuovo;;',
      '5;Competenza strana;magia;',
      '6;Link strano;;www.esempio',
    ].join('\n');
    const rows = planLessons(parseCsv(csv), existing).rows;
    expect(rows.map((r) => r.status)).toEqual(['error', 'error', 'new', 'error', 'error', 'new']);
    expect(rows[0].errors).toEqual(['Numero: "x" non è un numero intero']);
    expect(rows[1].errors).toEqual(['Titolo mancante']);
    expect(rows[3].errors).toEqual(['Numero 4 già usato alla riga 4']);
    expect(rows[4].errors).toEqual(['Competenze sconosciute: magia']);
    // Un link non http(s) passa con un avviso
    expect(rows[5].warnings).toEqual(['Video: "www.esempio" non sembra un link http(s)']);
  });

  it('senza colonne obbligatorie il file non si importa', () => {
    expect(planLessons(parseCsv('Titolo\nX'), existing).fileErrors).toEqual(['Mancano le colonne obbligatorie: Numero.']);
  });

  it('il modello è importabile', () => {
    const plan = planLessons(parseCsv(lessonsTemplateCsv()), []);
    expect(plan.rows.map((r) => r.status)).toEqual(['new']);
  });
});

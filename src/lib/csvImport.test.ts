import { describe, expect, it } from 'vitest';
import {
  formatDays, formatItDate, matchCourse, normalizeKey, parseDays, parseIntCell, parseItDate, parseList, parseTimeCell,
  readTable, RowPlanBuilder, summarize, tableFileErrors, type CsvColumn,
} from './csvImport';

const columns: CsvColumn<'a' | 'b' | 'c'>[] = [
  { key: 'a', header: 'Numero', aliases: ['n'], required: true },
  { key: 'b', header: 'Città' },
  { key: 'c', header: 'Stato', readOnly: true },
];

describe('readTable', () => {
  it('abbina le intestazioni senza badare a maiuscole, accenti e spazi', () => {
    const t = readTable([[' NUMERO ', 'citta', 'Stato', 'Boh'], ['1', ' Roma ', 'x', 'y']], columns);
    expect(t.records).toEqual([{ line: 2, values: { a: '1', b: 'Roma' } }]);
    expect([...t.present]).toEqual(['a', 'b']);
    expect(t.ignored).toEqual(['Stato']);
    expect(t.unknown).toEqual(['Boh']);
    expect(t.missing).toEqual([]);
  });

  it('accetta gli alias, salta le righe vuote e tiene il numero di riga del foglio', () => {
    const t = readTable([['n'], ['1'], [''], ['', ''], ['3']], columns);
    expect(t.records.map((r) => [r.line, r.values.a])).toEqual([[2, '1'], [5, '3']]);
    // Città assente: il campo non va toccato
    expect(t.present.has('b')).toBe(false);
  });

  it('segnala le colonne obbligatorie mancanti e il file vuoto', () => {
    expect(tableFileErrors(readTable([['Città'], ['Roma']], columns))).toEqual(['Mancano le colonne obbligatorie: Numero.']);
    expect(tableFileErrors(readTable([['Numero']], columns))).toEqual(['Il file non contiene righe da importare.']);
  });

  it("toglie l'apice anti-formula dalle celle", () => {
    expect(readTable([['Numero'], ["'-5"]], columns).records[0].values.a).toBe('-5');
  });
});

describe('RowPlanBuilder', () => {
  it('stato dalla riga: errore, nuova, modificata o invariata', () => {
    const err = new RowPlanBuilder(2, 'x');
    err.error('no');
    expect(err.build(true, 1)).toMatchObject({ status: 'error', data: null });

    expect(new RowPlanBuilder(3, 'x').build(true, 1).status).toBe('new');

    const same = new RowPlanBuilder(4, 'x');
    expect(same.diff('Titolo', null, '')).toBe(false);
    expect(same.diff('Giorni', [1, 3], [1, 3])).toBe(false);
    expect(same.build(false, 1).status).toBe('same');

    const upd = new RowPlanBuilder(5, 'x');
    expect(upd.diff('Titolo', 'A', 'B')).toBe(true);
    upd.diff('Descrizione', 'testo', null);
    expect(upd.build(false, 1)).toMatchObject({ status: 'update', changes: ['Titolo: "A" → "B"', 'Descrizione: "testo" → (vuoto)'] });
  });

  it('summarize conta gli stati', () => {
    const rows = [new RowPlanBuilder(2, 'a').build(true, 0), new RowPlanBuilder(3, 'b').build(false, 0)];
    expect(summarize(rows)).toEqual({ new: 1, update: 0, same: 1, error: 0 });
  });
});

describe('celle', () => {
  it('date italiane e ISO', () => {
    expect(parseItDate('05/10/2026', 'D')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseItDate('5/1/27', 'D')).toEqual({ ok: true, value: '2027-01-05' });
    expect(parseItDate('2026-10-05', 'D')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseItDate('2026-10-05 00:00:00', 'D')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseItDate('', 'D')).toEqual({ ok: true, value: null });
    expect(parseItDate('31/02/2026', 'D').ok).toBe(false);
    expect(parseItDate('domani', 'D').ok).toBe(false);
    expect(formatItDate('2026-10-05')).toBe('05/10/2026');
    expect(formatItDate(null)).toBe('');
  });

  it('giorni della settimana (0 = domenica) e ritorno', () => {
    expect(parseDays('Lun, Mer', 'G')).toEqual({ ok: true, value: [1, 3] });
    expect(parseDays('lunedì e mercoledì', 'G')).toEqual({ ok: true, value: [1, 3] });
    expect(parseDays('Domenica; sabato', 'G')).toEqual({ ok: true, value: [0, 6] });
    expect(parseDays('', 'G')).toEqual({ ok: true, value: [] });
    expect(parseDays('Lun, Fes', 'G').ok).toBe(false);
    expect(formatDays([0, 3, 1])).toBe('Lun, Mer, Dom');
    expect(formatDays(null)).toBe('');
  });

  it('orari, numeri ed elenchi', () => {
    expect(parseTimeCell('17.30', 'O')).toEqual({ ok: true, value: '17:30' });
    expect(parseTimeCell('9:05:00', 'O')).toEqual({ ok: true, value: '09:05' });
    expect(parseTimeCell('25:00', 'O').ok).toBe(false);
    expect(parseIntCell('12', 'N', { min: 1 })).toEqual({ ok: true, value: 12 });
    expect(parseIntCell('', 'N')).toEqual({ ok: true, value: null });
    expect(parseIntCell('0', 'N', { min: 1 }).ok).toBe(false);
    expect(parseIntCell('1,5', 'N').ok).toBe(false);
    expect(parseList(' a, b ,,a\nc ')).toEqual(['a', 'b', 'c']);
  });

  it('corso per titolo o slug', () => {
    const courses = [{ id: '1', title: 'Python Avanzato', slug: 'python-ai' }, { id: '2', title: 'Città digitali', slug: null }];
    expect(matchCourse('python avanzato', courses)?.id).toBe('1');
    expect(matchCourse('PYTHON-AI', courses)?.id).toBe('1');
    expect(matchCourse('citta digitali', courses)?.id).toBe('2');
    expect(matchCourse('Scratch', courses)).toBeUndefined();
    expect(normalizeKey('  Nome_Genitore ')).toBe('nome genitore');
  });
});

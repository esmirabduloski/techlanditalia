import { describe, expect, it } from 'vitest';
import {
  buildLessonDates,
  closureCountdown,
  closureDays,
  closureDraftError,
  closureForBanner,
  closureOn,
  easterSunday,
  formatClosureRange,
  missingHolidays,
  nationalHolidays,
  schoolYearLabel,
  schoolYearOf,
  upcomingClosures,
} from './schoolClosures';

const natale = { title: 'Vacanze di Natale', start_date: '2026-12-23', end_date: '2027-01-06' };
const immacolata = { title: 'Immacolata Concezione', start_date: '2026-12-08', end_date: '2026-12-08' };
const ponte = { title: 'Ponte', start_date: '2026-10-30', end_date: '2026-11-01' };
const TODAY = '2026-10-19';

describe('date delle chiusure', () => {
  it('conta i giorni con gli estremi compresi', () => {
    expect(closureDays(immacolata)).toBe(1);
    expect(closureDays(natale)).toBe(15);
  });

  it('trova la chiusura di un giorno, estremi compresi', () => {
    expect(closureOn([immacolata, natale], '2026-12-23')).toBe(natale);
    expect(closureOn([immacolata, natale], '2027-01-06')).toBe(natale);
    expect(closureOn([immacolata, natale], '2027-01-07')).toBeUndefined();
  });

  it('tiene solo quelle non finite, dalla più vicina', () => {
    const past = { title: 'Passata', start_date: '2026-10-01', end_date: '2026-10-04' };
    expect(upcomingClosures([natale, past, immacolata, ponte], TODAY)).toEqual([ponte, immacolata, natale]);
    // In corso conta come non finita
    expect(upcomingClosures([past], '2026-10-04')).toEqual([past]);
  });

  it('scrive il periodo in italiano, con l\'anno solo se serve', () => {
    expect(formatClosureRange(immacolata, TODAY)).toBe('Martedì 8 dicembre');
    expect(formatClosureRange({ start_date: '2027-01-01', end_date: '2027-01-01' }, TODAY)).toBe('Venerdì 1 gennaio 2027');
    expect(formatClosureRange({ start_date: '2026-12-23', end_date: '2026-12-31' }, TODAY)).toBe('Dal 23 al 31 dicembre');
    expect(formatClosureRange(ponte, TODAY)).toBe('Dal 30 ottobre al 1 novembre');
    expect(formatClosureRange(natale, TODAY)).toBe('Dal 23 dicembre 2026 al 6 gennaio 2027');
    expect(formatClosureRange({ start_date: '2027-03-28', end_date: '2027-03-29' }, TODAY)).toBe('Dal 28 al 29 marzo 2027');
  });

  it('dice al genitore quanto manca, solo nelle due settimane prima', () => {
    expect(closureCountdown(ponte, '2026-10-31')).toBe('In corso');
    expect(closureCountdown(ponte, '2026-10-29')).toBe('Domani');
    expect(closureCountdown(ponte, TODAY)).toBe('Tra 11 giorni');
    expect(closureCountdown(immacolata, TODAY)).toBeNull();
  });

  it('mette in cima la chiusura in corso o entro una settimana', () => {
    expect(closureForBanner([ponte, natale], TODAY)).toBeUndefined();
    expect(closureForBanner([natale, ponte], '2026-10-23')).toBe(ponte);
    expect(closureForBanner([natale, ponte], '2026-11-01')).toBe(ponte);
    expect(closureForBanner([natale, ponte], '2026-11-02')).toBeUndefined();
  });
});

describe('controllo della chiusura inserita dall\'admin', () => {
  const ok = { title: 'Vacanze di Natale', start_date: '2026-12-23', end_date: '2027-01-06', note: null };

  it('accetta una chiusura valida', () => {
    expect(closureDraftError(ok)).toBeNull();
  });

  it('rifiuta nome vuoto, date mancanti o al contrario e periodi troppo lunghi', () => {
    expect(closureDraftError({ ...ok, title: '   ' })).toMatch(/nome/);
    expect(closureDraftError({ ...ok, start_date: '' })).toMatch(/primo giorno/);
    expect(closureDraftError({ ...ok, end_date: '' })).toMatch(/ultimo giorno/);
    expect(closureDraftError({ ...ok, end_date: '2026-12-22' })).toMatch(/prima del primo/);
    expect(closureDraftError({ ...ok, end_date: '2028-01-06' })).toMatch(/anno/);
    expect(closureDraftError({ ...ok, note: 'x'.repeat(501) })).toMatch(/nota/);
  });
});

describe('festività nazionali', () => {
  it('calcola la Pasqua', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2028)).toBe('2028-04-16');
    expect(easterSunday(2038)).toBe('2038-04-25');
  });

  it('riconosce l\'anno scolastico da settembre', () => {
    expect(schoolYearOf('2026-10-19')).toBe(2026);
    expect(schoolYearOf('2026-09-01')).toBe(2026);
    expect(schoolYearOf('2027-08-31')).toBe(2026);
    expect(schoolYearLabel(2026)).toBe('2026/27');
  });

  it('elenca le festività dell\'anno scolastico, con San Francesco dal 2026', () => {
    const list = nationalHolidays(2026);
    expect(list.map((h) => `${h.start_date} ${h.title}`)).toEqual([
      "2026-10-04 San Francesco d'Assisi",
      '2026-11-01 Ognissanti',
      '2026-12-08 Immacolata Concezione',
      '2026-12-25 Natale e Santo Stefano',
      '2027-01-01 Capodanno',
      '2027-01-06 Epifania',
      '2027-03-28 Pasqua e Pasquetta',
      '2027-04-25 Festa della Liberazione',
      '2027-05-01 Festa dei Lavoratori',
      '2027-06-02 Festa della Repubblica',
      '2027-08-15 Ferragosto',
    ]);
    expect(list.find((h) => h.title === 'Pasqua e Pasquetta')?.end_date).toBe('2027-03-29');
    expect(list.find((h) => h.title === 'Natale e Santo Stefano')?.end_date).toBe('2026-12-26');
    expect(nationalHolidays(2025).some((h) => h.title.startsWith('San Francesco'))).toBe(false);
  });

  it('salta le passate, i doppioni e quelle già dentro un\'altra chiusura', () => {
    const missing = missingHolidays(nationalHolidays(2026), [natale, { ...immacolata, title: ' immacolata concezione ' }], TODAY);
    const titles = missing.map((h) => h.title);
    expect(titles).not.toContain("San Francesco d'Assisi"); // già passata
    expect(titles).not.toContain('Immacolata Concezione'); // già presente
    expect(titles).not.toContain('Natale e Santo Stefano'); // dentro le vacanze di Natale
    expect(titles).not.toContain('Capodanno');
    expect(titles).not.toContain('Epifania');
    expect(titles).toEqual(['Ognissanti', 'Pasqua e Pasquetta', 'Festa della Liberazione', 'Festa dei Lavoratori', 'Festa della Repubblica', 'Ferragosto']);
  });
});

describe('date delle lezioni di un gruppo', () => {
  it('usa i giorni della settimana scelti', () => {
    // Lunedì e giovedì dal 19 ottobre 2026 (lunedì)
    expect(buildLessonDates({ startDate: '2026-10-19', count: 4, lessonDays: [1, 4] }))
      .toEqual(['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']);
  });

  it('salta i giorni di chiusura e recupera dopo', () => {
    // Martedì: l'8 dicembre e le vacanze di Natale saltano
    expect(buildLessonDates({ startDate: '2026-12-01', count: 4, lessonDays: [2], closures: [immacolata, natale] }))
      .toEqual(['2026-12-01', '2026-12-15', '2026-12-22', '2027-01-12']);
  });

  it('attraversa il cambio dell\'ora legale senza perdere giorni', () => {
    expect(buildLessonDates({ startDate: '2026-10-23', count: 2, lessonDays: [5] })).toEqual(['2026-10-23', '2026-10-30']);
  });

  it('non gira all\'infinito senza giorni o con un orario impossibile', () => {
    expect(buildLessonDates({ startDate: '2026-10-19', count: 4, lessonDays: [] })).toEqual([]);
    const forever = [{ start_date: '2026-01-01', end_date: '2099-12-31' }];
    expect(buildLessonDates({ startDate: '2026-10-19', count: 4, lessonDays: [1], closures: forever })).toEqual([]);
  });
});

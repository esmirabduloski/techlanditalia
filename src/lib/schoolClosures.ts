import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { addDaysIso } from '@/lib/courseProposal';

/**
 * Calendario di chiusure e festività (tabella school_closures, migrazione 0060).
 * L'admin lo gestisce in /admin/chiusure, i genitori lo vedono nell'area
 * riservata e la generazione del calendario lezioni ne salta i giorni.
 * Le date sono sempre stringhe YYYY-MM-DD (giorni di calendario, niente fusi).
 */
// type e non interface: supabase-js vuole righe assegnabili a Record<string, unknown>
export type SchoolClosure = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  note: string | null;
  /** Quando il job school-closure-notice ha avvisato le famiglie (3 giorni prima). */
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClosureRange = Pick<SchoolClosure, 'start_date' | 'end_date'>;
export type SchoolClosureDraft = Pick<SchoolClosure, 'title' | 'start_date' | 'end_date' | 'note'>;

export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;
/** Oltre è quasi sempre un anno sbagliato, e farebbe saltare mesi di lezioni. */
export const MAX_CLOSURE_DAYS = 120;
/** Il genitore vede l'avviso in cima all'area riservata da così tanti giorni prima. */
export const BANNER_DAYS_BEFORE = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const localNoon = (iso: string) => new Date(`${iso}T12:00:00`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Giorni tra due date (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Giorno della settimana come Date.getDay(): 0 = domenica. */
export function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** Durata in giorni, estremi compresi. */
export function closureDays(c: ClosureRange): number {
  return daysBetween(c.start_date, c.end_date) + 1;
}

/** La chiusura che comprende il giorno, se c'è. */
export function closureOn<T extends ClosureRange>(closures: readonly T[], date: string): T | undefined {
  return closures.find((c) => c.start_date <= date && date <= c.end_date);
}

/** Chiusure non ancora finite (in corso o future), dalla più vicina. */
export function upcomingClosures<T extends ClosureRange>(closures: readonly T[], today: string): T[] {
  return closures
    .filter((c) => c.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
}

/**
 * "Martedì 8 dicembre", "Dal 23 al 31 dicembre", "Dal 30 marzo al 7 aprile",
 * "Dal 23 dicembre 2026 al 6 gennaio 2027". L'anno compare solo se non è
 * quello di `today`.
 */
export function formatClosureRange(c: ClosureRange, today: string): string {
  const start = localNoon(c.start_date);
  const end = localNoon(c.end_date);
  const year = today.slice(0, 4);
  const sameYear = c.start_date.slice(0, 4) === c.end_date.slice(0, 4);
  const withYear = c.start_date.slice(0, 4) !== year || c.end_date.slice(0, 4) !== year;
  const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: it });

  if (c.start_date === c.end_date) {
    return capitalize(fmt(start, withYear ? 'EEEE d MMMM yyyy' : 'EEEE d MMMM'));
  }
  const endText = fmt(end, withYear ? 'd MMMM yyyy' : 'd MMMM');
  if (!sameYear) return `Dal ${fmt(start, 'd MMMM yyyy')} al ${endText}`;
  if (c.start_date.slice(0, 7) === c.end_date.slice(0, 7)) return `Dal ${fmt(start, 'd')} al ${endText}`;
  return `Dal ${fmt(start, 'd MMMM')} al ${endText}`;
}

/** Etichetta per il genitore: "In corso", "Domani", "Tra 5 giorni" (entro due settimane), altrimenti null. */
export function closureCountdown(c: ClosureRange, today: string): string | null {
  if (c.start_date <= today && today <= c.end_date) return 'In corso';
  const days = daysBetween(today, c.start_date);
  if (days === 1) return 'Domani';
  if (days > 1 && days <= 14) return `Tra ${days} giorni`;
  return null;
}

/** La chiusura da segnalare in cima all'area genitore: in corso o che inizia entro BANNER_DAYS_BEFORE giorni. */
export function closureForBanner<T extends ClosureRange>(closures: readonly T[], today: string): T | undefined {
  return upcomingClosures(closures, today).find((c) => daysBetween(today, c.start_date) <= BANNER_DAYS_BEFORE);
}

/** Errore da mostrare all'admin, o null se la chiusura va bene. */
export function closureDraftError(d: SchoolClosureDraft): string | null {
  const title = d.title.trim();
  if (!title) return 'Scrivi il nome della chiusura (es. "Vacanze di Natale")';
  if (title.length > MAX_TITLE_LENGTH) return `Il nome può avere al massimo ${MAX_TITLE_LENGTH} caratteri`;
  if (!ISO_DATE.test(d.start_date) || Number.isNaN(toUtc(d.start_date))) return 'Scegli il primo giorno di chiusura';
  if (!ISO_DATE.test(d.end_date) || Number.isNaN(toUtc(d.end_date))) return "Scegli l'ultimo giorno di chiusura";
  if (d.end_date < d.start_date) return "L'ultimo giorno non può essere prima del primo";
  if (closureDays(d) > MAX_CLOSURE_DAYS) return `Una chiusura può durare al massimo ${MAX_CLOSURE_DAYS} giorni: controlla l'anno`;
  if ((d.note ?? '').length > MAX_NOTE_LENGTH) return `La nota può avere al massimo ${MAX_NOTE_LENGTH} caratteri`;
  return null;
}

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Anno di inizio dell'anno scolastico (da settembre): 2026 per tutto settembre 2026 - agosto 2027. */
export function schoolYearOf(today: string): number {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 9 ? year : year - 1;
}

export const schoolYearLabel = (startYear: number) => `${startYear}/${String(startYear + 1).slice(2)}`;

/**
 * Festività nazionali (L. 260/1949, L. 151/2025 per il 4 ottobre dal 2026)
 * dell'anno scolastico da settembre `startYear` ad agosto dell'anno dopo.
 */
export function nationalHolidays(startYear: number): SchoolClosureDraft[] {
  const y1 = startYear;
  const y2 = startYear + 1;
  const day = (y: number, md: string, title: string): SchoolClosureDraft => ({
    title, start_date: `${y}-${md}`, end_date: `${y}-${md}`, note: null,
  });
  const easter = easterSunday(y2);
  return [
    ...(y1 >= 2026 ? [day(y1, '10-04', "San Francesco d'Assisi")] : []),
    day(y1, '11-01', 'Ognissanti'),
    day(y1, '12-08', 'Immacolata Concezione'),
    { title: 'Natale e Santo Stefano', start_date: `${y1}-12-25`, end_date: `${y1}-12-26`, note: null },
    day(y2, '01-01', 'Capodanno'),
    day(y2, '01-06', 'Epifania'),
    { title: 'Pasqua e Pasquetta', start_date: easter, end_date: addDaysIso(easter, 1), note: null },
    day(y2, '04-25', 'Festa della Liberazione'),
    day(y2, '05-01', 'Festa dei Lavoratori'),
    day(y2, '06-02', 'Festa della Repubblica'),
    day(y2, '08-15', 'Ferragosto'),
  ];
}

/**
 * Le festività da aggiungere: non ancora passate, non già presenti con lo
 * stesso nome e giorno, non già coperte per intero da un'altra chiusura
 * (es. Natale dentro "Vacanze di Natale").
 */
export function missingHolidays(
  holidays: readonly SchoolClosureDraft[],
  existing: readonly Pick<SchoolClosure, 'title' | 'start_date' | 'end_date'>[],
  today: string,
): SchoolClosureDraft[] {
  return holidays.filter((h) =>
    h.end_date >= today &&
    !existing.some((c) => c.start_date === h.start_date && c.title.trim().toLowerCase() === h.title.toLowerCase()) &&
    !existing.some((c) => c.start_date <= h.start_date && h.end_date <= c.end_date),
  );
}

/**
 * Date delle lezioni di un gruppo: i giorni della settimana scelti a partire
 * da `startDate`, saltando i giorni di chiusura.
 */
export function buildLessonDates(opts: {
  startDate: string;
  count: number;
  lessonDays: readonly number[];
  closures?: readonly ClosureRange[];
}): string[] {
  const dates: string[] = [];
  if (opts.count <= 0 || opts.lessonDays.length === 0) return dates;
  let day = opts.startDate.slice(0, 10);
  // Limite di sicurezza: dieci anni di calendario
  for (let i = 0; dates.length < opts.count && i < 3660; i++) {
    if (opts.lessonDays.includes(weekday(day)) && !closureOn(opts.closures ?? [], day)) dates.push(day);
    day = addDaysIso(day, 1);
  }
  return dates;
}

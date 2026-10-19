import { describe, expect, it } from 'vitest';
import {
  catalogTotals,
  dayLabel,
  formatTime,
  groupByDay,
  romeDay,
  sanitizeSearch,
  sinceIso,
  type CatalogEntry,
  type UpcomingEmail,
} from './emailCenter';

const upcoming = (scheduledFor: string, kind = 'pause_ending'): UpcomingEmail => ({
  kind,
  label: kind,
  scheduledFor,
  recipientName: null,
  recipientEmail: null,
  studentName: null,
  channel: 'email',
  description: '',
});

describe('date nell\'ora di Roma', () => {
  it('giorno e ora', () => {
    expect(romeDay('2026-10-31T23:30:00Z')).toBe('2026-11-01');
    expect(formatTime('2026-11-02T07:00:00.000Z')).toBe('08:00');
    expect(formatTime('2026-10-20T07:00:00.000Z')).toBe('09:00');
    expect(dayLabel('2026-10-26')).toBe('lunedì 26 ottobre 2026');
  });
});

describe('groupByDay', () => {
  it('raggruppa per giorno e ordina', () => {
    const groups = groupByDay([
      upcoming('2026-11-01T06:00:00.000Z', 'staff_data_retention'),
      upcoming('2026-10-26T07:00:00.000Z'),
      upcoming('2026-11-01T07:00:00.000Z', 'payment_overdue'),
    ]);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.kind)])).toEqual([
      ['2026-10-26', ['pause_ending']],
      ['2026-11-01', ['staff_data_retention', 'payment_overdue']],
    ]);
    expect(groups[1].label).toBe('domenica 1 novembre 2026');
  });
});

describe('helper', () => {
  it('sinceIso', () => {
    expect(sinceIso(7, new Date('2026-10-19T10:00:00Z'))).toBe('2026-10-12T10:00:00.000Z');
  });

  it('sanitizeSearch toglie i caratteri dei filtri', () => {
    expect(sanitizeSearch('  rossi,(test)*% ')).toBe('rossi test');
    expect(sanitizeSearch('anna@example.com')).toBe('anna@example.com');
  });

  it('catalogTotals somma gli ultimi 30 giorni', () => {
    const entry = (sent30d: number, failed30d: number) => ({ sent30d, failed30d }) as CatalogEntry;
    expect(catalogTotals([entry(3, 1), entry(2, 0)])).toEqual({ sent: 5, failed: 1 });
  });
});

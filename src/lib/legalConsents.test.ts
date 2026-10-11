import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { consentRecordsToCsv, formatVersionDate, summarizePending, type ConsentRecord, type PendingConsent } from './legalConsents';

const pending: PendingConsent[] = [
  { subject_id: null, subject_name: null, document: 'privacy', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: null, subject_name: null, document: 'terms', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: 'c1', subject_name: 'Marco', document: 'privacy', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: 'c1', subject_name: 'Marco', document: 'terms', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: 'c2', subject_name: 'Giulia', document: 'terms', version: '2026-10-11', published_at: '2026-10-11' },
];

describe('summarizePending', () => {
  it('elenca ogni documento una volta e ogni figlio coinvolto', () => {
    const { documents, children } = summarizePending(pending);
    expect(documents.map((d) => d.document)).toEqual(['privacy', 'terms']);
    expect(children).toEqual([
      { id: 'c1', name: 'Marco' },
      { id: 'c2', name: 'Giulia' },
    ]);
  });

  it('senza figli in sospeso restituisce solo i documenti', () => {
    expect(summarizePending(pending.slice(0, 2)).children).toEqual([]);
  });
});

describe('formatVersionDate', () => {
  it('scrive la data in italiano', () => {
    expect(formatVersionDate('2026-10-11')).toBe('11 ottobre 2026');
  });
});

describe('consentRecordsToCsv', () => {
  it('esporta una riga per consenso con il figlio e la versione', () => {
    const record: ConsentRecord = {
      id: 'r1',
      accepted_by: 'p1',
      accepted_by_name: 'Anna "Nina" Rossi',
      accepted_by_email: 'anna@example.com',
      subject_id: 'c1',
      subject_name: 'Marco',
      capacity: 'parent_for_child',
      document: 'privacy',
      version: '2026-10-11',
      accepted_at: '2026-10-11T08:30:00Z',
      ip: '1.2.3.4',
      user_agent: 'Safari',
    };
    const [header, row] = consentRecordsToCsv([record]).split('\r\n');
    expect(header).toContain('"Per conto di"');
    expect(row).toContain('"Anna ""Nina"" Rossi"');
    expect(row).toContain('"Marco";"Informativa privacy";"2026-10-11"');
  });
});

import { describe, expect, it } from 'vitest';
import { reasonText, summarizeCancellations } from './subscriptionCancellation';

describe('reasonText', () => {
  it('etichetta del motivo, o il testo libero per "Altro"', () => {
    expect(reasonText({ reason: 'cost', reason_other: null })).toBe('Costo');
    expect(reasonText({ reason: 'other', reason_other: ' Cambio scuola ' })).toBe('Altro: Cambio scuola');
    expect(reasonText({ reason: 'other', reason_other: '' })).toBe('Altro');
  });
});

describe('summarizeCancellations', () => {
  it('conta i motivi dal più frequente e le risposte "tornereste?"', () => {
    const s = summarizeCancellations([
      { reason: 'schedule', would_return: 'yes' },
      { reason: 'cost', would_return: 'maybe' },
      { reason: 'cost', would_return: 'no' },
    ]);
    expect(s.total).toBe(3);
    expect(s.reasons).toEqual([
      { reason: 'cost', count: 2 },
      { reason: 'schedule', count: 1 },
    ]);
    expect(s.byReturn).toEqual({ yes: 1, maybe: 1, no: 1 });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { hasDelivery, isSubmissionLocked } from './gradeWithoutSubmission';

describe('hasDelivery', () => {
  it('riconosce file o note', () => {
    expect(hasDelivery({ file_url: 'u/a.png', notes: null })).toBe(true);
    expect(hasDelivery({ file_url: null, notes: '[CODE]\nprint(1)' })).toBe(true);
    expect(hasDelivery({ file_url: null, notes: null })).toBe(false);
    expect(hasDelivery(null)).toBe(false);
  });
});

describe('isSubmissionLocked', () => {
  it('blocca le consegne valutate o approvate', () => {
    expect(isSubmissionLocked({ status: 'graded', file_url: 'u/a.png' })).toBe(true);
    expect(isSubmissionLocked({ status: 'approved', notes: 'x' })).toBe(true);
  });
  it('lascia consegnare dopo una valutazione senza consegna', () => {
    expect(isSubmissionLocked({ status: 'graded', file_url: null, notes: null })).toBe(false);
  });
  it('lascia aggiornare le consegne in attesa', () => {
    expect(isSubmissionLocked({ status: 'pending', notes: 'x' })).toBe(false);
    expect(isSubmissionLocked(null)).toBe(false);
  });
});

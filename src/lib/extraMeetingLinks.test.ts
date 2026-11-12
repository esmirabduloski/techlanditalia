import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { validateExtraLink } from './extraMeetingLinks';

describe('validateExtraLink', () => {
  it('link vuoto: si toglie il pulsante, il testo non serve', () => {
    expect(validateExtraLink('', '')).toBeNull();
    expect(validateExtraLink('Vecchio testo', '   ')).toBeNull();
  });
  it('serve il testo del pulsante', () => {
    expect(validateExtraLink('  ', 'https://meet.google.com/abc')).toMatch(/testo del pulsante/);
    expect(validateExtraLink('x'.repeat(81), 'https://meet.google.com/abc')).toMatch(/80 caratteri/);
  });
  it('solo link https senza spazi', () => {
    expect(validateExtraLink('LINK PER GRUPPO DEL MARTEDÌ', 'https://meet.google.com/abc-defg-hij')).toBeNull();
    expect(validateExtraLink('A', 'http://meet.google.com/abc')).toMatch(/https/);
    expect(validateExtraLink('A', 'meet.google.com/abc')).toMatch(/https/);
    expect(validateExtraLink('A', 'https://meet google.com')).toMatch(/https/);
    expect(validateExtraLink('A', 'javascript:alert(1)')).toMatch(/https/);
  });
});

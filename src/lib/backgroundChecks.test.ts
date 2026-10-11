import { describe, expect, it } from 'vitest';
import { backgroundCheckStatus, defaultNextCheck } from './backgroundChecks';

const check = (next: string) => ({ user_id: 'u', verified_at: '2025-10-01', next_check_at: next });
const today = new Date(2026, 9, 11); // 11 ottobre 2026, ora locale

describe('backgroundCheckStatus', () => {
  it('senza verifica è mancante', () => {
    expect(backgroundCheckStatus(undefined, today)).toBe('missing');
  });
  it('scaduto il giorno dopo la data del prossimo controllo', () => {
    expect(backgroundCheckStatus(check('2026-10-10'), today)).toBe('expired');
  });
  it('in scadenza fino a 30 giorni prima, incluso il giorno stesso', () => {
    expect(backgroundCheckStatus(check('2026-10-11'), today)).toBe('expiring');
    expect(backgroundCheckStatus(check('2026-11-10'), today)).toBe('expiring');
  });
  it('valido oltre i 30 giorni', () => {
    expect(backgroundCheckStatus(check('2026-11-11'), today)).toBe('ok');
  });
});

describe('defaultNextCheck', () => {
  it('propone il rinnovo dopo 12 mesi', () => {
    expect(defaultNextCheck('2026-10-11')).toBe('2027-10-11');
  });
});

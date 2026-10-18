import { describe, expect, it } from 'vitest';
import { aiConsentStatus, aiDecisionText, birthYearOptions, canSelfConsent, type AiConsent } from './aiConsents';

const today = new Date('2026-10-18T10:00:00');

const consent = (overrides: Partial<AiConsent> = {}): AiConsent => ({
  student_id: 's1',
  granted: true,
  version: 'v1',
  decided_by: 'p1',
  decided_as: 'parent',
  decided_at: '2026-10-18T10:00:00Z',
  ...overrides,
});

describe('canSelfConsent', () => {
  it('senza anno di nascita decide il genitore', () => {
    expect(canSelfConsent(null, today)).toBe(false);
    expect(canSelfConsent(undefined, today)).toBe(false);
  });

  it("nell'anno del 14° compleanno decide ancora il genitore", () => {
    // Nato nel 2012: nel 2026 ha 13 o 14 anni, non è certo
    expect(canSelfConsent(2012, today)).toBe(false);
  });

  it("dall'anno dopo il 14° compleanno può decidere da solo", () => {
    expect(canSelfConsent(2011, today)).toBe(true);
    expect(canSelfConsent(2009, today)).toBe(true);
  });

  it('i bambini piccoli non decidono mai da soli', () => {
    expect(canSelfConsent(2018, today)).toBe(false);
  });
});

describe('birthYearOptions', () => {
  it('va dai 4 ai 19 anni, come il controllo nel database', () => {
    const years = birthYearOptions(today);
    expect(years[0]).toBe(2022);
    expect(years[years.length - 1]).toBe(2007);
  });
});

describe('aiConsentStatus', () => {
  it('senza riga il consenso non è dato', () => {
    expect(aiConsentStatus(undefined, 'v1')).toBe('none');
  });

  it('distingue attivo e revocato', () => {
    expect(aiConsentStatus(consent(), 'v1')).toBe('granted');
    expect(aiConsentStatus(consent({ granted: false }), 'v1')).toBe('revoked');
  });

  it('un consenso su una versione vecchia va rinnovato', () => {
    expect(aiConsentStatus(consent({ version: 'v1' }), 'v2')).toBe('outdated');
  });

  it('una revoca resta una revoca anche se la versione è cambiata', () => {
    expect(aiConsentStatus(consent({ granted: false, version: 'v1' }), 'v2')).toBe('revoked');
  });
});

describe('aiDecisionText', () => {
  const viewer = { id: 'p1', studentName: 'Marco Rossi' };

  it('dice chi ha deciso', () => {
    expect(aiDecisionText(consent(), 'v1', viewer)).toBe('Attivato da te il 18/10/2026');
    expect(aiDecisionText(consent({ decided_by: 'p2' }), 'v1', viewer)).toBe('Attivato da un genitore il 18/10/2026');
    expect(aiDecisionText(consent({ decided_as: 'student', decided_by: 's1' }), 'v1', viewer)).toBe(
      'Attivato da Marco il 18/10/2026',
    );
    expect(aiDecisionText(consent({ granted: false, decided_as: 'admin', decided_by: 'a1' }), 'v1', viewer)).toBe(
      'Disattivato dalla segreteria Techland il 18/10/2026',
    );
  });

  it('senza decisione o con versione vecchia', () => {
    expect(aiDecisionText(undefined, 'v1', viewer)).toBe('Non attivo');
    expect(aiDecisionText(consent(), 'v2', viewer)).toBe('Da rinnovare: gli strumenti AI sono cambiati');
  });
});

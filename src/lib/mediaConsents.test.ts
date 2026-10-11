import { describe, expect, it } from 'vitest';
import { consentKey, consentStatus, splitByConsent, type MediaConsent } from './mediaConsents';

const consent = (student_id: string, granted: boolean, purpose: MediaConsent['purpose'] = 'social'): MediaConsent => ({
  student_id,
  purpose,
  granted,
  decided_at: '2026-10-01T10:00:00Z',
});

describe('consentStatus', () => {
  it('senza riga il consenso non è dato', () => {
    expect(consentStatus(undefined)).toBe('none');
  });

  it('distingue concesso e revocato', () => {
    expect(consentStatus(consent('a', true))).toBe('granted');
    expect(consentStatus(consent('a', false))).toBe('revoked');
  });
});

describe('splitByConsent', () => {
  const students = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const consents = new Map<string, MediaConsent>([
    [consentKey('a', 'social'), consent('a', true)],
    [consentKey('b', 'social'), consent('b', false)],
    [consentKey('c', 'open_day'), consent('c', true, 'open_day')],
  ]);

  it('fa comparire solo chi ha il consenso per quella finalità', () => {
    const { allowed, blocked } = splitByConsent(students, consents, 'social');
    expect(allowed.map((s) => s.id)).toEqual(['a']);
    expect(blocked.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('un consenso non vale per le altre finalità', () => {
    const { allowed } = splitByConsent(students, consents, 'open_day');
    expect(allowed.map((s) => s.id)).toEqual(['c']);
  });
});

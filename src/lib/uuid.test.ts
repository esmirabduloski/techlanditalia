import { describe, expect, it, vi, afterEach } from 'vitest';
import { randomUUID } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa crypto.randomUUID quando esiste', () => {
    expect(randomUUID()).toMatch(UUID_V4);
  });

  it('ripiega su getRandomValues nei browser vecchi', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const a = randomUUID();
    const b = randomUUID();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});

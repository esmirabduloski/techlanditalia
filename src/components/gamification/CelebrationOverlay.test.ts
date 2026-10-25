// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelebrationOverlay } from './CelebrationOverlay';

// jsdom non ha IntersectionObserver/ResizeObserver/matchMedia né WebGL:
// la figura 3D non parte e resta l'immagine pre-renderizzata.
beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const levelUp = (extra: object = {}) =>
  render(createElement(CelebrationOverlay, {
    type: 'level-up',
    title: 'Livello 4',
    subtitle: 'Sei diventato Costruttore! 🔧',
    isVisible: true,
    onClose: () => {},
    ...extra,
  }));

describe('festa di nuovo livello', () => {
  it("mostra l'evoluzione dell'avatar dalla forma vecchia alla nuova", () => {
    const { container } = levelUp({ avatarId: 8, level: 4, previousLevel: 3 });
    expect(screen.getByText(/Il tuo Drago si è evoluto/)).toBeTruthy();
    expect(screen.getByText('Draghetto alato')).toBeTruthy();
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('old');
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/drago\/3/);

    act(() => vi.advanceTimersByTime(1400));
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('new');
    expect(screen.getByRole('img', { name: 'Drago: Draghetto alato' })).toBeTruthy();
  });

  it("senza avatar (genitore) resta il trofeo, senza testo sull'evoluzione", () => {
    const { container } = levelUp();
    expect(screen.queryByText(/si è evoluto/)).toBeNull();
    expect(container.querySelector('[data-phase]')).toBeNull();
  });
});

// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PendingConsent } from '@/lib/legalConsents';

const pending: PendingConsent[] = [
  { subject_id: null, subject_name: null, document: 'privacy', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: 'c1', subject_name: 'Marco', document: 'privacy', version: '2026-10-11', published_at: '2026-10-11' },
  { subject_id: 'c1', subject_name: 'Marco', document: 'terms', version: '2026-10-11', published_at: '2026-10-11' },
];

const fetchPendingConsents = vi.fn<() => Promise<PendingConsent[]>>();
const recordConsents = vi.fn<(p: PendingConsent[]) => Promise<number>>();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'p1' }, isLoading: false, mfa: { needsMfa: false }, signOut: vi.fn() }),
}));
vi.mock('@/lib/legalConsents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legalConsents')>()),
  fetchPendingConsents: () => fetchPendingConsents(),
  recordConsents: (p: PendingConsent[]) => recordConsents(p),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { ConsentGate } = await import('./ConsentGate');
// Precarica il modulo lazy e allarga il timeout: con tutta la suite in parallelo 1 s non basta.
await import('./ConsentCheck');
configure({ asyncUtilTimeout: 5000 });

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [path] }, h(ConsentGate, null, h('p', null, 'DATI PRIVATI')))),
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ConsentGate', () => {
  it('blocca l’area riservata finché il genitore non accetta per sé e per il figlio', async () => {
    fetchPendingConsents.mockResolvedValueOnce(pending).mockResolvedValue([]);
    recordConsents.mockResolvedValue(3);
    renderAt('/area-riservata');

    expect(await screen.findByText('Prima di continuare')).toBeTruthy();
    expect(screen.queryByText('DATI PRIVATI')).toBeNull();
    expect(screen.getByText('Marco')).toBeTruthy();

    const button = screen.getByRole('button', { name: 'Accetto e continuo' }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole('checkbox', { name: /Ho letto/ }));
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /responsabilità genitoriale/ }));
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await waitFor(() => expect(recordConsents).toHaveBeenCalledWith(pending));
    expect(await screen.findByText('DATI PRIVATI')).toBeTruthy();
  });

  it('lascia passare chi non ha nulla in sospeso', async () => {
    fetchPendingConsents.mockResolvedValue([]);
    renderAt('/area-riservata/acquisti');
    expect(await screen.findByText('DATI PRIVATI')).toBeTruthy();
  });

  it('non blocca il profilo, da cui si può eliminare l’account', () => {
    fetchPendingConsents.mockResolvedValue(pending);
    renderAt('/area-riservata/profilo');
    expect(screen.getByText('DATI PRIVATI')).toBeTruthy();
    expect(fetchPendingConsents).not.toHaveBeenCalled();
  });

  it('se il controllo fallisce non chiude fuori il genitore', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchPendingConsents.mockRejectedValue(new Error('function not found'));
    renderAt('/area-riservata');
    expect(await screen.findByText('DATI PRIVATI')).toBeTruthy();
  });
});

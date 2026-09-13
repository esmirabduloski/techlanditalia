import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type SwNavigateMessage = { type?: string; path?: string };

/**
 * Collega le notifiche push alla navigazione dell'app:
 * - click su una notifica con il sito già aperto → il service worker manda
 *   `techland:navigate` e qui apriamo la pagina indicata (es. la chat live);
 * - notifica ricevuta con il sito in primo piano → Firebase non mostra nulla
 *   di sistema, quindi mostriamo un toast con il pulsante "Apri".
 * Non rende nulla e non chiede mai permessi.
 */
export function PushNavigationListener() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent<SwNavigateMessage>) => {
      const data = event.data;
      if (!data || data.type !== 'techland:navigate' || typeof data.path !== 'string') return;
      if (!data.path.startsWith('/')) return;
      navigate(data.path);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    // Solo utenti loggati con permesso già concesso: evitiamo di caricare l'SDK
    // Firebase (import dinamico) per tutti i visitatori del sito.
    if (!user || typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    import('@/lib/push')
      .then((mod) =>
        mod.listenForegroundPush(({ title, body, path }) => {
          toast(title, {
            description: body,
            duration: 15000,
            action: path
              ? { label: 'Apri', onClick: () => navigate(path) }
              : undefined,
          });
        })
      )
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else cleanup = unsubscribe;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user, navigate]);

  return null;
}

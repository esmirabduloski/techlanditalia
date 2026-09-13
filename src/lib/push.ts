import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
  appId,
  messagingSenderId: appId?.split(':')[1] ?? '',
};

export type PushStatus =
  | 'registered'
  | 'not-configured'
  | 'unsupported'
  | 'open-in-new-tab'
  | 'ios-add-to-home'
  | 'denied'
  | 'error';

export type PushResult = { status: PushStatus; token?: string; message?: string };

export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.messagingSenderId &&
    vapidKey
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as unknown as { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  if (isIos()) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

/** Deve essere chiamata da un click dell'utente: i browser ignorano le richieste senza gesto. */
export async function enablePush(): Promise<PushResult> {
  try {
    if (!isPushConfigured()) return { status: 'not-configured' };
    if (typeof window === 'undefined') return { status: 'unsupported' };
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      if (isIos() && !isStandalone()) return { status: 'ios-add-to-home' };
      return { status: 'unsupported' };
    }
    if (!(await isSupported())) {
      if (isIos() && !isStandalone()) return { status: 'ios-add-to-home' };
      return { status: 'unsupported' };
    }
    if (window.top !== window.self) return { status: 'open-in-new-tab' };
    if (isIos() && !isStandalone()) return { status: 'ios-add-to-home' };

    const permission =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { status: 'denied' };

    const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`
    );
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration });
    if (!token) return { status: 'denied' };

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { status: 'error', message: 'Sessione non valida' };

    const { error } = await supabase
      .from('push_devices')
      .upsert(
        {
          user_id: userId,
          token,
          platform: detectPlatform(),
          user_agent: navigator.userAgent.slice(0, 400),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );
    if (error) return { status: 'error', message: error.message };

    return { status: 'registered', token };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Errore sconosciuto' };
  }
}

export type ForegroundPush = { title: string; body: string; path: string | null };

/**
 * Notifiche ricevute mentre il sito è aperto e visibile: in quel caso l'SDK Firebase
 * NON mostra la notifica di sistema ma la consegna alla pagina, che deve gestirla da sé.
 * Richiede il permesso già concesso (non lo chiede mai). Restituisce la funzione di cleanup.
 */
export async function listenForegroundPush(
  handler: (push: ForegroundPush) => void
): Promise<() => void> {
  const noop = () => undefined;
  try {
    if (!isPushConfigured() || typeof window === 'undefined') return noop;
    if (!('Notification' in window) || Notification.permission !== 'granted') return noop;
    if (!('serviceWorker' in navigator) || !(await isSupported())) return noop;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const data = (payload.data ?? {}) as Record<string, string | undefined>;
      const raw = data.path ?? data.link ?? payload.fcmOptions?.link ?? null;
      let path: string | null = null;
      if (raw) {
        try {
          const url = new URL(raw, window.location.origin);
          if (url.origin === window.location.origin) path = url.pathname + url.search + url.hash;
        } catch {
          path = null;
        }
      }
      handler({
        title: payload.notification?.title ?? 'Nuova notifica',
        body: payload.notification?.body ?? '',
        path,
      });
    });
  } catch {
    return noop;
  }
}

/** Disattiva le notifiche rimuovendo i dispositivi registrati dell'utente. */
export async function disablePush(): Promise<{ error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sessione non valida' };
  const { error } = await supabase.from('push_devices').delete().eq('user_id', userId);
  return { error: error?.message };
}

export async function countMyPushDevices(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;
  const { count } = await supabase
    .from('push_devices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

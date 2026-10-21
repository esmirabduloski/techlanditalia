/**
 * Cloudflare Turnstile: verifica anti-bot dei moduli pubblici e della chat AI.
 * Il widget lo gestisce src/hooks/useTurnstile.ts, il controllo del token
 * supabase/functions/_shared/turnstile.ts.
 *
 * Site key del widget "Techland moduli pubblici" (dashboard Cloudflare →
 * Turnstile). È pubblica: finisce comunque nel bundle del sito.
 * Vuota = verifica spenta nel sito.
 */
const SITE_KEY = "0x4AAAAAAFe6AUA_Z1TX5uM9";

/** VITE_TURNSTILE_SITE_KEY la sostituisce: i test e2e usano la chiave di prova di Cloudflare. */
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? SITE_KEY;

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileRenderOptions {
  sitekey: string;
  /** Nome del modulo, visibile nelle statistiche di Cloudflare. */
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  size?: "normal" | "flexible" | "compact";
  language?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (code: string) => boolean | void;
  /** Il widget sta per comparire: Cloudflare chiede un clic. */
  "before-interactive-callback"?: () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi | null> | null = null;

/** Carica lo script di Cloudflare una volta sola; null se non si carica (rete, blocco pubblicità). */
export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      script.remove();
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

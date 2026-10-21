import { useCallback, useEffect, useRef, useState } from "react";
import { loadTurnstile, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

/** Attesa massima del token all'invio: di solito arriva in 1-2 secondi. */
const WAIT_MS = 10_000;

/**
 * Verifica anti-bot Cloudflare Turnstile per un modulo pubblico.
 *
 *   const turnstile = useTurnstile("contatti");
 *   <TurnstileSlot turnstile={turnstile} />       // sopra il pulsante di invio
 *   const turnstileToken = await turnstile.getToken();
 *   await invoke({ ...dati, turnstileToken });
 *   turnstile.reset();                            // ogni token vale una volta sola
 *
 * Il widget è invisibile per quasi tutti: compare solo quando Cloudflare chiede
 * un clic. Lo script si carica quando il modulo si avvicina allo schermo.
 * Senza site key (src/lib/turnstile.ts), o se lo script non si carica,
 * getToken() restituisce undefined: decide il server.
 */
export function useTurnstile(action: string) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  /** true quando il widget è visibile e aspetta un clic. */
  const [interactive, setInteractive] = useState(false);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const failed = useRef(false);
  const waiters = useRef<((token: string | undefined) => void)[]>([]);

  const settle = (value: string | undefined) => {
    waiters.current.splice(0).forEach((resolve) => resolve(value));
  };

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container) return;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        loadTurnstile().then((turnstile) => {
          if (cancelled) return;
          if (!turnstile) {
            failed.current = true;
            settle(undefined);
            return;
          }
          widgetId.current =
            turnstile.render(container, {
              sitekey: TURNSTILE_SITE_KEY,
              action,
              appearance: "interaction-only",
              // Il widget normale è largo 300px: sui telefoni stretti va quello compatto
              size: container.clientWidth < 300 ? "compact" : "flexible",
              language: "it",
              callback: (t) => {
                token.current = t;
                failed.current = false;
                settle(t);
              },
              "expired-callback": () => {
                token.current = null;
              },
              "error-callback": () => {
                token.current = null;
                failed.current = true;
                settle(undefined);
                return true;
              },
              "before-interactive-callback": () => setInteractive(true),
            }) ?? null;
        });
      },
      { rootMargin: "400px" },
    );
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      token.current = null;
      failed.current = false;
      setInteractive(false);
    };
  }, [container, action]);

  /** Token per il prossimo invio; undefined se la verifica è spenta o non riesce. */
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!TURNSTILE_SITE_KEY || failed.current) return Promise.resolve(undefined);
    if (token.current) return Promise.resolve(token.current);
    return new Promise((resolve) => {
      const done = (value: string | undefined) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        waiters.current = waiters.current.filter((w) => w !== done);
        resolve(undefined);
      }, WAIT_MS);
      waiters.current.push(done);
    });
  }, []);

  /** Da chiamare dopo ogni invio al server: il token usato non vale più. */
  const reset = useCallback(() => {
    token.current = null;
    if (!widgetId.current) return;
    failed.current = false;
    setInteractive(false);
    window.turnstile?.reset(widgetId.current);
  }, []);

  return { containerRef: setContainer, interactive, getToken, reset };
}

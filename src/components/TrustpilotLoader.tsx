import { useEffect } from 'react';

let loaded = false;

/**
 * Lazily injects the Trustpilot bootstrap script only when a Trustpilot widget
 * is actually rendered (e.g. parent dashboard). Keeps it off the public homepage.
 */
export function TrustpilotLoader() {
  useEffect(() => {
    if (loaded) {
      // Re-init in case widget was added after script load
      const w = (window as any).Trustpilot;
      if (w && typeof w.loadFromElement === 'function') {
        document.querySelectorAll('.trustpilot-widget').forEach((el) => {
          try { w.loadFromElement(el, true); } catch { /* noop */ }
        });
      }
      return;
    }
    loaded = true;
    const s = document.createElement('script');
    s.src = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return null;
}

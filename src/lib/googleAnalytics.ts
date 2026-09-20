// Google Analytics 4 (gtag.js) — caricamento lato client.
// L'ID di misurazione arriva dal connettore Google Analytics:
// VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY (es. G-XXXXXXXXXX).

const measurementId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as
  | string
  | undefined;

// Google Ads tag (AW-...): stesso gtag.js di GA4, basta un config aggiuntivo.
// NON incollare lo snippet completo di Google Ads: creerebbe un doppio tag.
const adsId = "AW-18464577415";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function isGAConfigured(): boolean {
  return Boolean(measurementId);
}

export function initGA(): void {
  if (initialized || !measurementId) return;
  if (typeof document === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  // send_page_view manuale: le page_view le inviamo noi a ogni cambio route SPA
  window.gtag("config", measurementId, { send_page_view: false });
}

export function trackGAPageView(path: string): void {
  if (!initialized || typeof window.gtag !== "function" || !measurementId) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}

export function trackGAEvent(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  if (!initialized || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
}

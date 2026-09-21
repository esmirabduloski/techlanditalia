/**
 * Cattura e memorizzazione del codice referral (?ref=CODICE).
 * Il codice viene salvato sia in localStorage sia in sessionStorage, così
 * resta disponibile anche se il visitatore atterra su una pagina qualsiasi
 * e prenota solo in un secondo momento.
 */
const KEY = "referral_code";

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return code.length >= 4 ? code : null;
}

export function captureReferralFromUrl(search?: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(search ?? window.location.search);
  const code = normalizeReferralCode(params.get("ref"));
  if (!code) return null;
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  try { sessionStorage.setItem(KEY, code); } catch { /* ignore */ }
  return code;
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  let code: string | null = null;
  try { code = sessionStorage.getItem(KEY); } catch { /* ignore */ }
  if (!code) {
    try { code = localStorage.getItem(KEY); } catch { /* ignore */ }
  }
  return normalizeReferralCode(code);
}

export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

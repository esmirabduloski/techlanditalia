/**
 * CORS condiviso: consente le chiamate SOLO dai domini del progetto.
 *
 * Prima ogni funzione rispondeva con `Access-Control-Allow-Origin: *`, quindi
 * qualsiasi sito terzo poteva invocarla dal browser di un utente. Qui l'origin
 * viene riflesso solo se compreso nell'allowlist (dominio pubblico, www,
 * dominio di pubblicazione e preview *.lovable.app / localhost in sviluppo).
 */

const ALLOWED_HOSTS = new Set([
  "techlanditalia.it",
  "www.techlanditalia.it",
  "techlanditalia.lovable.app",
  "localhost",
  "127.0.0.1",
]);

export const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

const DEFAULT_ORIGIN = "https://techlanditalia.it";

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (ALLOWED_HOSTS.has(url.hostname)) return true;
    // Preview e published Lovable (id-preview--xxx.lovable.app, *.lovableproject.com)
    if (url.hostname.endsWith(".lovable.app")) return true;
    if (url.hostname.endsWith(".lovableproject.com")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Header CORS per la richiesta corrente. Le chiamate server-to-server (cron,
 * webhook, curl) non inviano `Origin`: in quel caso non c'è nessun browser da
 * proteggere e restituiamo il dominio principale.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** CORS aperto: solo per endpoint pubblici per natura (sitemap, llms.txt). */
export const publicCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS,
};

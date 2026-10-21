/**
 * Verifica anti-bot Cloudflare Turnstile per i moduli pubblici e la chat AI.
 *
 * Il sito (src/hooks/useTurnstile.ts) manda `turnstileToken` con i dati del
 * modulo; qui lo si conferma con Cloudflare prima di salvare o rispondere.
 *
 * - Senza il secret TURNSTILE_SECRET_KEY la verifica è spenta.
 * - Con il secret, i token mancanti o rifiutati finiscono in security_events
 *   (turnstile_missing / turnstile_failed) ma l'invio passa: serve a
 *   controllare per qualche giorno che nessuna persona vera venga bloccata.
 * - Con anche TURNSTILE_ENFORCE=true quegli invii ricevono un 403.
 *
 * Se Cloudflare non risponde o rifiuta il secret l'invio passa comunque
 * (evento turnstile_unavailable): restano i limiti per IP, l'honeypot e gli
 * altri controlli della funzione.
 */
import { clientIp } from "./clientip.ts";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;
/** Lunghezza massima di un token secondo Cloudflare. */
const MAX_TOKEN_LENGTH = 2048;

/** Errori che dipendono dalla configurazione o da Cloudflare, non dal visitatore. */
const NOT_VISITOR_ERRORS = new Set(["missing-input-secret", "invalid-input-secret", "bad-request", "internal-error"]);

export const TURNSTILE_BLOCKED_MESSAGE =
  "Non siamo riusciti a verificare che tu non sia un bot. Ricarica la pagina e riprova; " +
  "se il problema continua scrivici a info@techlanditalia.it.";

export type TurnstileVerdict =
  | { status: "ok" }
  | { status: "missing" }
  | { status: "failed"; errors: string[] }
  | { status: "unavailable"; detail: string };

/** Riga di security_events (stessa forma dei log delle funzioni). */
export type TurnstileEvent = {
  event_type: string;
  identifier?: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
};

export interface TurnstileSettings {
  secret?: string;
  enforce: boolean;
}

export function turnstileSettings(): TurnstileSettings {
  return {
    secret: Deno.env.get("TURNSTILE_SECRET_KEY") || undefined,
    enforce: Deno.env.get("TURNSTILE_ENFORCE") === "true",
  };
}

/** Chiede a Cloudflare se il token è valido (ogni token vale una volta sola). */
export async function verifyTurnstileToken(
  secret: string,
  token: unknown,
  remoteIp: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerdict> {
  if (typeof token !== "string" || token === "") return { status: "missing" };
  if (token.length > MAX_TOKEN_LENGTH) return { status: "failed", errors: ["token-too-long"] };

  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp !== "unknown" ? { remoteip: remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: "unavailable", detail: `HTTP ${res.status}` };

    const data = await res.json();
    if (data?.success === true) return { status: "ok" };
    const errors: string[] = Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [];
    if (errors.some((e) => NOT_VISITOR_ERRORS.has(e))) {
      return { status: "unavailable", detail: errors.join(",") };
    }
    return { status: "failed", errors };
  } catch (e) {
    return { status: "unavailable", detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Restituisce una Response 403 se l'invio va bloccato, altrimenti null
 * (verifica spenta, token valido, modalità solo log, Cloudflare non raggiungibile).
 */
export async function turnstileGuard(
  req: Request,
  opts: {
    token: unknown;
    endpoint: string;
    /** Email o sessione, per ritrovare l'invio nei log. */
    identifier?: string;
    logEvent: (event: TurnstileEvent) => Promise<void>;
    corsHeaders: Record<string, string>;
    settings?: TurnstileSettings;
    fetchImpl?: typeof fetch;
  },
): Promise<Response | null> {
  const { secret, enforce } = opts.settings ?? turnstileSettings();
  if (!secret) return null;

  const ip = clientIp(req);
  const verdict = await verifyTurnstileToken(secret, opts.token, ip, opts.fetchImpl);
  if (verdict.status === "ok") return null;

  const base = {
    identifier: opts.identifier,
    ip_address: ip,
    user_agent: req.headers.get("user-agent") || "",
    endpoint: opts.endpoint,
  };

  if (verdict.status === "unavailable") {
    console.error(`[turnstile] verifica non disponibile (${opts.endpoint}):`, verdict.detail);
    await opts.logEvent({ ...base, event_type: "turnstile_unavailable", severity: "error", metadata: { detail: verdict.detail } });
    return null;
  }

  await opts.logEvent({
    ...base,
    event_type: verdict.status === "missing" ? "turnstile_missing" : "turnstile_failed",
    severity: enforce ? "warn" : "info",
    metadata: { enforced: enforce, ...(verdict.status === "failed" ? { errors: verdict.errors } : {}) },
  });
  if (!enforce) return null;

  return new Response(JSON.stringify({ error: TURNSTILE_BLOCKED_MESSAGE }), {
    status: 403,
    headers: { ...opts.corsHeaders, "Content-Type": "application/json" },
  });
}

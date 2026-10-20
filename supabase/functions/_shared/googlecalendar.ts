/**
 * Collegamento diretto a Google Calendar (OAuth 2.0 + Calendar API v3, senza SDK).
 *
 * L'insegnante autorizza TECHLAND una volta con lo scope calendar.app.created:
 * l'app crea nel suo account il calendario «TECHLAND · Lezioni» e può gestire
 * solo quello, senza vedere né toccare gli altri suoi calendari. Da lì in poi
 * google-calendar-sync lo riallinea poco dopo ogni modifica alle lezioni.
 *
 * Ogni evento ha come id quello della lezione (uuid senza trattini, valido per
 * Google) e in extendedProperties.private un'impronta del contenuto: la
 * sincronizzazione scrive solo gli eventi nuovi o cambiati e toglie quelli
 * delle lezioni che non ci sono più.
 *
 * Le chiamate ricevono `fetch` come parametro, così i test non vanno in rete.
 */
import { CALENDAR_NAME, type EventTime, type LessonEvent, TZID } from "./teachercalendar.ts";

export type Fetch = typeof fetch;

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const SCOPES = ["openid", "email", CALENDAR_SCOPE];
/** Pagina del sito dove Google rimanda l'insegnante (redirect URI da registrare). */
export const CALLBACK_PATH = "/insegnante/google-calendar";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
/** Scritture in parallelo verso Google: poche, per stare nei limiti per utente. */
const CONCURRENCY = 4;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** null finché i segreti GOOGLE_CALENDAR_CLIENT_ID/SECRET non sono impostati. */
export function googleConfig(get: (name: string) => string | undefined): GoogleConfig | null {
  const clientId = get("GOOGLE_CALENDAR_CLIENT_ID")?.trim();
  const clientSecret = get("GOOGLE_CALENDAR_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) return null;
  const site = (get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
  return { clientId, clientSecret, redirectUri: `${site}${CALLBACK_PATH}` };
}

// ── OAuth ────────────────────────────────────────────────────────────────────

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Stringa casuale base64url (state e code_verifier PKCE). */
export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return base64url(b);
}

export const STATE_RE = /^[A-Za-z0-9_-]{43}$/;

/** code_challenge S256 (RFC 7636). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizationUrl(cfg: GoogleConfig, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // refresh token anche se l'insegnante aveva già autorizzato l'app
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params}`;
}

export class GoogleError extends Error {
  constructor(message: string, readonly status: number, readonly reason: string) {
    super(message);
    this.name = "GoogleError";
  }
}

/** Il refresh token non vale più: l'insegnante ha tolto l'accesso da Google. */
export const isRevoked = (e: unknown) => e instanceof GoogleError && e.reason === "invalid_grant";
/** Il calendario «TECHLAND · Lezioni» è stato eliminato dall'insegnante. */
export const isCalendarMissing = (e: unknown) => e instanceof GoogleError && e.reason === "calendarMissing";

async function googleError(res: Response, what: string): Promise<GoogleError> {
  let reason = "";
  let message = "";
  try {
    const body = await res.json();
    if (typeof body?.error === "string") {
      // Errori OAuth: { error, error_description }
      reason = body.error;
      message = body.error_description ?? body.error;
    } else if (body?.error) {
      // Errori della Calendar API: { error: { code, message, errors: [{ reason }] } }
      reason = body.error.errors?.[0]?.reason ?? body.error.status ?? "";
      message = body.error.message ?? "";
    }
  } catch {
    // corpo non JSON
  }
  return new GoogleError(`${what}: ${res.status} ${message || reason}`.trim(), res.status, reason);
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

async function tokenRequest(params: Record<string, string>, fetchFn: Fetch, what: string): Promise<TokenResponse> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw await googleError(res, what);
  return await res.json() as TokenResponse;
}

export function exchangeCode(cfg: GoogleConfig, code: string, codeVerifier: string, fetchFn: Fetch = fetch) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
  }, fetchFn, "Scambio del codice Google");
}

export async function refreshAccessToken(cfg: GoogleConfig, refreshToken: string, fetchFn: Fetch = fetch): Promise<string> {
  const res = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  }, fetchFn, "Rinnovo dell'accesso Google");
  return res.access_token;
}

/** Revoca il permesso dato a TECHLAND (best effort: false se Google rifiuta). */
export async function revokeToken(token: string, fetchFn: Fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function hasCalendarScope(scope: string | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(CALENDAR_SCOPE);
}

/** Email dell'account Google dall'id_token (solo da mostrare: la firma non serve). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = idToken?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

// ── Eventi ───────────────────────────────────────────────────────────────────

type GoogleTime = { date: string } | { dateTime: string; timeZone: string };

export interface GoogleEvent {
  id: string;
  status: "confirmed";
  summary: string;
  description: string;
  location?: string;
  start: GoogleTime;
  end: GoogleTime;
  source: { title: string; url: string };
  transparency: "opaque";
  extendedProperties: { private: { techland: "1"; h: string } };
}

export interface ExistingEvent {
  id: string;
  /** Impronta del contenuto scritta da TECHLAND */
  hash: string | null;
}

/** id dell'evento Google: l'uuid della lezione senza trattini (caratteri base32hex). */
export function googleEventId(lessonId: string): string {
  const id = lessonId.toLowerCase().replace(/-/g, "");
  if (!/^[0-9a-v]{5,1024}$/.test(id)) throw new Error(`id lezione non valido per Google: ${lessonId}`);
  return id;
}

const googleTime = (t: EventTime): GoogleTime => ("date" in t ? { date: t.date } : { dateTime: t.dateTime, timeZone: TZID });

async function contentHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return base64url(new Uint8Array(digest)).slice(0, 22);
}

export async function toGoogleEvent(e: LessonEvent): Promise<GoogleEvent> {
  const content = {
    summary: e.summary,
    description: e.description,
    ...(e.location ? { location: e.location } : {}),
    start: googleTime(e.start),
    end: googleTime(e.end),
    source: { title: "TECHLAND", url: e.url },
  };
  return {
    id: googleEventId(e.lessonId),
    status: "confirmed",
    ...content,
    transparency: "opaque",
    extendedProperties: { private: { techland: "1", h: await contentHash(content) } },
  };
}

export interface SyncPlan {
  insert: GoogleEvent[];
  update: GoogleEvent[];
  remove: string[];
}

/** Cosa scrivere su Google per passare da `existing` a `desired`. */
export function planSync(desired: GoogleEvent[], existing: ExistingEvent[]): SyncPlan {
  const have = new Map(existing.map((e) => [e.id, e.hash]));
  const want = new Set(desired.map((e) => e.id));
  return {
    insert: desired.filter((e) => !have.has(e.id)),
    update: desired.filter((e) => have.has(e.id) && have.get(e.id) !== e.extendedProperties.private.h),
    remove: existing.filter((e) => !want.has(e.id)).map((e) => e.id),
  };
}

// ── Calendar API ─────────────────────────────────────────────────────────────

const CALENDAR_DESCRIPTION =
  "Le tue lezioni TECHLAND, aggiornate in automatico. Non modificare gli eventi qui: le modifiche verrebbero sovrascritte.";

export function calendarApi(accessToken: string, fetchFn: Fetch = fetch) {
  const enc = encodeURIComponent;
  const call = async (method: string, path: string, what: string, body?: unknown) => {
    const res = await fetchFn(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await googleError(res, what);
    return res.status === 204 ? null : await res.json();
  };
  const ignoreGone = (e: unknown) => {
    if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) return;
    throw e;
  };

  return {
    async createCalendar(): Promise<string> {
      const c = await call("POST", "/calendars", "Creazione del calendario", {
        summary: CALENDAR_NAME,
        description: CALENDAR_DESCRIPTION,
        timeZone: TZID,
      });
      return c.id as string;
    },

    /** Il calendario creato da TECHLAND esiste ancora ed è raggiungibile? */
    async calendarExists(calendarId: string): Promise<boolean> {
      try {
        await call("GET", `/calendars/${enc(calendarId)}`, "Lettura del calendario");
        return true;
      } catch (e) {
        if (e instanceof GoogleError && [403, 404, 410].includes(e.status)) return false;
        throw e;
      }
    },

    async deleteCalendar(calendarId: string): Promise<void> {
      await call("DELETE", `/calendars/${enc(calendarId)}`, "Eliminazione del calendario").catch(ignoreGone);
    },

    /** Gli eventi di TECHLAND che finiscono dopo timeMin. */
    async listEvents(calendarId: string, timeMin: string): Promise<ExistingEvent[]> {
      const out: ExistingEvent[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          privateExtendedProperty: "techland=1",
          timeMin,
          maxResults: "2500",
          showDeleted: "false",
          singleEvents: "true",
          fields: "items(id,extendedProperties/private),nextPageToken",
        });
        if (pageToken) params.set("pageToken", pageToken);
        let page: { items?: { id: string; extendedProperties?: { private?: { h?: string } } }[]; nextPageToken?: string };
        try {
          page = await call("GET", `/calendars/${enc(calendarId)}/events?${params}`, "Lettura degli eventi");
        } catch (e) {
          if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) {
            throw new GoogleError(e.message, e.status, "calendarMissing");
          }
          throw e;
        }
        for (const item of page.items ?? []) {
          out.push({ id: item.id, hash: item.extendedProperties?.private?.h ?? null });
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
      return out;
    },

    async insertEvent(calendarId: string, event: GoogleEvent): Promise<void> {
      await call("POST", `/calendars/${enc(calendarId)}/events`, "Creazione evento", event);
    },

    async updateEvent(calendarId: string, event: GoogleEvent): Promise<void> {
      await call("PUT", `/calendars/${enc(calendarId)}/events/${enc(event.id)}`, "Aggiornamento evento", event);
    },

    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
      await call("DELETE", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, "Eliminazione evento").catch(ignoreGone);
    },
  };
}

export type CalendarApi = ReturnType<typeof calendarApi>;

async function runPool(tasks: (() => Promise<void>)[], size: number): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
}

export interface SyncStats {
  inserted: number;
  updated: number;
  removed: number;
  unchanged: number;
}

/**
 * Allinea il calendario alle lezioni. Gli eventi che finiscono prima di
 * timeMin (lezioni uscite dalla finestra) restano come storico.
 */
export async function syncCalendar(
  api: CalendarApi,
  calendarId: string,
  events: LessonEvent[],
  timeMin: string,
): Promise<SyncStats> {
  const desired = await Promise.all(events.map(toGoogleEvent));
  const plan = planSync(desired, await api.listEvents(calendarId, timeMin));

  await runPool([
    ...plan.insert.map((e) => async () => {
      try {
        await api.insertEvent(calendarId, e);
      } catch (err) {
        // Stesso id già usato (evento cancellato in passato): si riscrive
        if (err instanceof GoogleError && err.status === 409) await api.updateEvent(calendarId, e);
        else throw err;
      }
    }),
    ...plan.update.map((e) => () => api.updateEvent(calendarId, e)),
    ...plan.remove.map((id) => () => api.deleteEvent(calendarId, id)),
  ], CONCURRENCY);

  return {
    inserted: plan.insert.length,
    updated: plan.update.length,
    removed: plan.remove.length,
    unchanged: desired.length - plan.insert.length - plan.update.length,
  };
}

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authorizationUrl,
  CALENDAR_SCOPE,
  calendarApi,
  emailFromIdToken,
  exchangeCode,
  type GoogleConfig,
  googleConfig,
  googleEventId,
  type GoogleEvent,
  hasCalendarScope,
  isCalendarMissing,
  isRevoked,
  pkceChallenge,
  planSync,
  randomToken,
  refreshAccessToken,
  STATE_RE,
  syncCalendar,
  toGoogleEvent,
} from "./googlecalendar.ts";
import { type FeedGroup, type FeedLesson, lessonEvents } from "./teachercalendar.ts";

const cfg: GoogleConfig = {
  clientId: "client.apps.googleusercontent.com",
  clientSecret: "segreto",
  redirectUri: "https://techlanditalia.it/insegnante/google-calendar",
};

const group: FeedGroup = {
  id: "g1",
  title: "Python Lunedì",
  status: "active",
  archived_at: null,
  lesson_time: "17:00",
  teacher_meeting_link: "https://meet.google.com/abc",
  updated_at: "2026-10-01T08:00:00Z",
  course_title: "Python Base",
  course_emoji: "🐍",
};
const lesson = (n: number, over: Partial<FeedLesson> = {}): FeedLesson => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  group_id: "g1",
  lesson_number: n,
  lesson_date: `2026-11-0${n}`,
  lesson_time: null,
  lesson_title: null,
  updated_at: "2026-10-10T09:30:00Z",
  ...over,
});
const events = (lessons: FeedLesson[], g = group) => lessonEvents([g], lessons, "https://techlanditalia.it");

/** Google Calendar finto: token, calendari ed eventi in memoria. */
function fakeGoogle() {
  const calls: string[] = [];
  const calendars = new Map<string, Map<string, GoogleEvent & { status: string }>>();
  let revoked = false;
  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const apiError = (code: number, reason: string) => reply(code, { error: { code, message: reason, errors: [{ reason }] } });

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.href.startsWith("https://oauth2.googleapis.com/token")) {
      const form = new URLSearchParams(String(init?.body));
      if (revoked) return reply(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
      return reply(200, {
        access_token: "access-1",
        ...(form.get("grant_type") === "authorization_code"
          ? { refresh_token: "refresh-1", scope: `openid ${CALENDAR_SCOPE}` }
          : {}),
      });
    }
    const path = url.pathname.replace("/calendar/v3", "");
    if (method === "POST" && path === "/calendars") {
      const id = `cal${calendars.size + 1}@group.calendar.google.com`;
      calendars.set(id, new Map());
      return reply(200, { id });
    }
    const m = path.match(/^\/calendars\/([^/]+)(?:\/events(?:\/([^/]+))?)?$/);
    const cal = m ? calendars.get(decodeURIComponent(m[1])) : undefined;
    if (!m || !cal) return apiError(404, "notFound");
    const eventId = m[2] && decodeURIComponent(m[2]);
    if (!path.includes("/events")) {
      if (method === "DELETE") calendars.delete(decodeURIComponent(m[1]));
      return reply(method === "DELETE" ? 204 : 200, method === "DELETE" ? undefined : { id: m[1] });
    }
    if (method === "GET") {
      expect(url.searchParams.get("privateExtendedProperty")).toBe("techland=1");
      const items = [...cal.values()]
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({ id: e.id, extendedProperties: e.extendedProperties }));
      return reply(200, { items });
    }
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (method === "POST") {
      if (cal.has(body.id)) return apiError(409, "duplicate");
      cal.set(body.id, body);
      return reply(200, body);
    }
    if (method === "PUT") {
      if (!cal.has(eventId!)) return apiError(404, "notFound");
      cal.set(eventId!, body);
      return reply(200, body);
    }
    if (method === "DELETE") {
      const e = cal.get(eventId!);
      if (!e || e.status === "cancelled") return apiError(410, "deleted");
      cal.set(eventId!, { ...e, status: "cancelled" });
      return reply(204);
    }
    return apiError(400, "badRequest");
  }) as typeof fetch;

  return { fetchFn, calls, calendars, revoke: () => (revoked = true) };
}

describe("configurazione e OAuth", () => {
  it("spento finché mancano i segreti; redirect sul sito", () => {
    expect(googleConfig(() => undefined)).toBeNull();
    expect(googleConfig((k) => ({ GOOGLE_CALENDAR_CLIENT_ID: "id" } as Record<string, string>)[k])).toBeNull();
    const env: Record<string, string> = {
      GOOGLE_CALENDAR_CLIENT_ID: " id ",
      GOOGLE_CALENDAR_CLIENT_SECRET: "s",
      SITE_URL: "https://techlanditalia.it/",
    };
    expect(googleConfig((k) => env[k])).toEqual({
      clientId: "id",
      clientSecret: "s",
      redirectUri: "https://techlanditalia.it/insegnante/google-calendar",
    });
  });

  it("state casuale e code_challenge S256 (RFC 7636)", async () => {
    const state = randomToken();
    expect(state).toMatch(STATE_RE);
    expect(randomToken()).not.toBe(state);
    const verifier = randomToken(48);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(await pkceChallenge(verifier)).toBe(expected);
  });

  it("URL di autorizzazione con solo calendar.app.created e accesso offline", () => {
    const url = new URL(authorizationUrl(cfg, "stato", "sfida"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("scope")).toBe(`openid email ${CALENDAR_SCOPE}`);
    expect(p.get("redirect_uri")).toBe(cfg.redirectUri);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("state")).toBe("stato");
    expect(p.get("code_challenge")).toBe("sfida");
    expect(p.get("code_challenge_method")).toBe("S256");
  });

  it("scambio del codice, rinnovo e revoca riconosciuta", async () => {
    const google = fakeGoogle();
    const tokens = await exchangeCode(cfg, "codice", "verifier", google.fetchFn);
    expect(tokens.refresh_token).toBe("refresh-1");
    expect(hasCalendarScope(tokens.scope)).toBe(true);
    expect(hasCalendarScope("openid email")).toBe(false);
    expect(await refreshAccessToken(cfg, "refresh-1", google.fetchFn)).toBe("access-1");

    google.revoke();
    const err = await refreshAccessToken(cfg, "refresh-1", google.fetchFn).catch((e) => e);
    expect(isRevoked(err)).toBe(true);
  });

  it("email dall'id_token", () => {
    const payload = Buffer.from(JSON.stringify({ email: "giulia.neri@gmail.com" })).toString("base64url");
    expect(emailFromIdToken(`x.${payload}.y`)).toBe("giulia.neri@gmail.com");
    expect(emailFromIdToken(undefined)).toBeNull();
    expect(emailFromIdToken("non-un-token")).toBeNull();
  });
});

describe("eventi Google", () => {
  it("id dalla lezione, orario di Roma o tutto il giorno", async () => {
    expect(googleEventId("0D3A5F00-1111-4222-8333-444455556666")).toBe("0d3a5f00111142228333444455556666");
    const [timed] = await Promise.all(events([lesson(1)]).map(toGoogleEvent));
    expect(timed.start).toEqual({ dateTime: "2026-11-01T17:00:00", timeZone: "Europe/Rome" });
    expect(timed.end).toEqual({ dateTime: "2026-11-01T18:00:00", timeZone: "Europe/Rome" });
    expect(timed.summary).toBe("🐍 Python Lunedì · Lezione 1");
    expect(timed.location).toBe("https://meet.google.com/abc");
    expect(timed.extendedProperties.private.techland).toBe("1");

    const [allDay] = await Promise.all(events([lesson(2)], { ...group, lesson_time: null, teacher_meeting_link: null }).map(toGoogleEvent));
    expect(allDay.start).toEqual({ date: "2026-11-02" });
    expect(allDay.end).toEqual({ date: "2026-11-03" });
    expect(allDay).not.toHaveProperty("location");
    expect(allDay.source.url).toBe("https://techlanditalia.it/insegnante/gruppo/g1");
  });

  it("l'impronta cambia solo se cambia ciò che si vede", async () => {
    const hash = async (l: FeedLesson, g = group) => (await toGoogleEvent(events([l], g)[0])).extendedProperties.private.h;
    const base = await hash(lesson(1));
    expect(await hash(lesson(1, { updated_at: "2026-10-15T00:00:00Z" }))).toBe(base);
    expect(await hash(lesson(1, { lesson_time: "18:00" }))).not.toBe(base);
    expect(await hash(lesson(1), { ...group, teacher_meeting_link: "https://meet.google.com/xyz" })).not.toBe(base);
  });

  it("piano: nuovi, cambiati, da togliere", async () => {
    const [a, b, c] = await Promise.all(events([lesson(1), lesson(2), lesson(3)]).map(toGoogleEvent));
    const plan = planSync([a, b, c], [
      { id: a.id, hash: a.extendedProperties.private.h },
      { id: b.id, hash: "vecchia" },
      { id: "zzz", hash: "x" },
    ]);
    expect(plan.insert.map((e) => e.id)).toEqual([c.id]);
    expect(plan.update.map((e) => e.id)).toEqual([b.id]);
    expect(plan.remove).toEqual(["zzz"]);
  });
});

describe("syncCalendar", () => {
  const TIME_MIN = "2026-08-01T00:00:00Z";

  it("crea, aggiorna solo ciò che cambia, toglie le lezioni sparite", async () => {
    const google = fakeGoogle();
    const api = calendarApi("access-1", google.fetchFn);
    const cal = await api.createCalendar();

    expect(await syncCalendar(api, cal, events([lesson(1), lesson(2)]), TIME_MIN))
      .toEqual({ inserted: 2, updated: 0, removed: 0, unchanged: 0 });
    expect(google.calendars.get(cal)!.size).toBe(2);

    // Nessun cambio: nessuna scrittura
    google.calls.length = 0;
    expect(await syncCalendar(api, cal, events([lesson(1), lesson(2)]), TIME_MIN))
      .toEqual({ inserted: 0, updated: 0, removed: 0, unchanged: 2 });
    expect(google.calls.filter((c) => !c.startsWith("GET"))).toEqual([]);

    // Lezione 1 spostata, lezione 2 tolta, lezione 3 nuova
    const stats = await syncCalendar(api, cal, events([lesson(1, { lesson_time: "18:30" }), lesson(3)]), TIME_MIN);
    expect(stats).toEqual({ inserted: 1, updated: 1, removed: 1, unchanged: 0 });
    const stored = google.calendars.get(cal)!;
    expect(stored.get(googleEventId(lesson(1).id))!.start).toEqual({ dateTime: "2026-11-01T18:30:00", timeZone: "Europe/Rome" });
    expect(stored.get(googleEventId(lesson(2).id))!.status).toBe("cancelled");

    // La lezione 2 torna: stesso id già usato su Google → si riscrive (409 → PUT)
    expect(await syncCalendar(api, cal, events([lesson(1, { lesson_time: "18:30" }), lesson(2), lesson(3)]), TIME_MIN))
      .toEqual({ inserted: 1, updated: 0, removed: 0, unchanged: 2 });
    expect(stored.get(googleEventId(lesson(2).id))!.status).toBe("confirmed");
  });

  it("calendario eliminato dall'insegnante: errore riconoscibile", async () => {
    const google = fakeGoogle();
    const api = calendarApi("access-1", google.fetchFn);
    const cal = await api.createCalendar();
    expect(await api.calendarExists(cal)).toBe(true);
    await api.deleteCalendar(cal);
    expect(await api.calendarExists(cal)).toBe(false);
    // Eliminare di nuovo non è un errore
    await api.deleteCalendar(cal);
    const err = await syncCalendar(api, cal, events([lesson(1)]), TIME_MIN).catch((e) => e);
    expect(isCalendarMissing(err)).toBe(true);
  });
});

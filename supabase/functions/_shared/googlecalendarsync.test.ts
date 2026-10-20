import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CALENDAR_SCOPE, type GoogleConfig } from "./googlecalendar.ts";
import { CALENDAR_MISSING_MESSAGE, type Connection, REVOKED_MESSAGE, syncConnection } from "./googlecalendarsync.ts";

type Row = Record<string, unknown>;

/** Il minimo di supabase-js usato dalla sincronizzazione, su tabelle in memoria. */
function fakeDb(tables: Record<string, Row[]>) {
  const query = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const rows = () => (tables[table] ??= []).filter((r) => filters.every((f) => f(r)));
    const run = () => {
      const matched = rows();
      if (patch) matched.forEach((r) => Object.assign(r, patch));
      return { data: matched, error: null };
    };
    const q = {
      select: () => q,
      update: (values: Row) => ((patch = values), q),
      eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
      is: (col: string, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), q),
      in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), q),
      gte: (col: string, v: string) => (filters.push((r) => String(r[col]) >= v), q),
      lte: (col: string, v: string) => (filters.push((r) => String(r[col]) <= v), q),
      order: () => q,
      range: () => q,
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return q;
  };
  return { from: query } as unknown as SupabaseClient;
}

const cfg: GoogleConfig = { clientId: "id", clientSecret: "s", redirectUri: "https://techlanditalia.it/insegnante/google-calendar" };
const TEACHER = "t1";
const NOW = new Date("2026-10-20T10:00:00Z");

function setup() {
  const connection: Row = {
    teacher_id: TEACHER, refresh_token: "refresh-1", calendar_id: "cal1", status: "active",
    dirty_at: "2026-10-20T09:59:00.123456+00:00", retry_after: "2026-10-20T10:05:00Z", last_error: "vecchio", last_synced_at: null,
  };
  const db = fakeDb({
    google_calendar_connections: [connection],
    user_roles: [{ user_id: TEACHER, role: "teacher" }],
    student_groups: [{
      id: "g1", title: "Python Lunedì", status: "active", archived_at: null, lesson_time: "17:00",
      teacher_meeting_link: null, updated_at: null, teacher_id: TEACHER, courses: { title: "Python Base", emoji: "🐍" },
    }],
    group_lesson_schedule: [{
      id: "00000000-0000-4000-8000-000000000001", group_id: "g1", lesson_number: 1, lesson_date: "2026-10-26",
      lesson_time: null, lesson_title: null, updated_at: "2026-10-10T09:30:00Z",
    }],
  });
  const conn: Connection = {
    teacher_id: TEACHER, refresh_token: "refresh-1", calendar_id: "cal1", dirty_at: connection.dirty_at as string,
  };
  return { db, connection, conn };
}

/** Google che risponde sempre allo stesso modo all'API calendario. */
function google(opts: { token?: Response; events?: Response }) {
  const written: string[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return opts.token ?? new Response(JSON.stringify({ access_token: "a", scope: CALENDAR_SCOPE }), { status: 200 });
    }
    if ((init?.method ?? "GET") === "GET") return opts.events ?? new Response(JSON.stringify({ items: [] }), { status: 200 });
    written.push(`${init?.method} ${new URL(url).pathname}`);
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return { fetchFn, written };
}

describe("syncConnection", () => {
  it("scrive le lezioni e azzera dirty, errore e prenotazione", async () => {
    const { db, connection, conn } = setup();
    const g = google({});
    const outcome = await syncConnection(db, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: g.fetchFn });
    expect(outcome).toEqual({ ok: true, stats: { inserted: 1, updated: 0, removed: 0, unchanged: 0 } });
    expect(g.written).toEqual(["POST /calendar/v3/calendars/cal1/events"]);
    expect(connection).toMatchObject({ dirty_at: null, retry_after: null, last_error: null, status: "active" });
    expect(connection.last_synced_at).toBeTruthy();
  });

  it("una modifica arrivata durante la sincronizzazione resta da fare", async () => {
    const { db, connection, conn } = setup();
    connection.dirty_at = "2026-10-20T10:00:01.000001+00:00";
    await syncConnection(db, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: google({}).fetchFn });
    expect(connection.dirty_at).toBe("2026-10-20T10:00:01.000001+00:00");
  });

  it("chi non è più insegnante: il calendario si svuota", async () => {
    const { conn } = setup();
    const g = google({
      events: new Response(JSON.stringify({ items: [{ id: "abc12", extendedProperties: { private: { h: "x" } } }] }), { status: 200 }),
    });
    const noRole = fakeDb({ google_calendar_connections: [], user_roles: [] });
    const outcome = await syncConnection(noRole, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: g.fetchFn });
    expect(outcome).toMatchObject({ ok: true, stats: { removed: 1, inserted: 0 } });
    expect(g.written).toEqual(["DELETE /calendar/v3/calendars/cal1/events/abc12"]);
  });

  it("accesso revocato da Google: la connessione si ferma", async () => {
    const { db, connection, conn } = setup();
    const token = new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    const outcome = await syncConnection(db, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: google({ token }).fetchFn });
    expect(outcome).toEqual({ ok: false, status: "revoked", error: REVOKED_MESSAGE });
    expect(connection).toMatchObject({ status: "revoked", last_error: REVOKED_MESSAGE, retry_after: null });
  });

  it("calendario eliminato da Google: la connessione si ferma", async () => {
    const { db, connection, conn } = setup();
    const events = new Response(JSON.stringify({ error: { code: 404, message: "Not Found", errors: [{ reason: "notFound" }] } }), { status: 404 });
    const outcome = await syncConnection(db, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: google({ events }).fetchFn });
    expect(outcome).toEqual({ ok: false, status: "calendar_missing", error: CALENDAR_MISSING_MESSAGE });
    expect(connection.status).toBe("calendar_missing");
  });

  it("Google non disponibile: si riprova tra 10 minuti, ancora da fare", async () => {
    const { db, connection, conn } = setup();
    const events = new Response(JSON.stringify({ error: { code: 503, message: "Backend Error", errors: [{ reason: "backendError" }] } }), { status: 503 });
    const before = Date.now();
    const outcome = await syncConnection(db, cfg, conn, { siteUrl: "https://techlanditalia.it", now: NOW, fetchFn: google({ events }).fetchFn });
    expect(outcome).toMatchObject({ ok: false, status: "error" });
    expect(connection.status).toBe("active");
    expect(connection.dirty_at).toBe(conn.dirty_at);
    expect(Date.parse(connection.retry_after as string)).toBeGreaterThanOrEqual(before + 10 * 60_000 - 1000);
    expect(connection.last_error).toContain("503");
  });
});

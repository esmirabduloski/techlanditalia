import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCheckInEnvelope, buildErrorEnvelope, parseDsn, withCronMonitor } from "./sentry.ts";

const lines = (envelope: string) => envelope.trim().split("\n").map((l) => JSON.parse(l));

describe("parseDsn", () => {
  it("ricava chiave ed endpoint envelope", () => {
    expect(parseDsn("https://abc123@o42.ingest.de.sentry.io/4507")).toEqual({
      publicKey: "abc123",
      envelopeUrl: "https://o42.ingest.de.sentry.io/api/4507/envelope/",
    });
  });

  it("mantiene un eventuale prefisso di percorso", () => {
    expect(parseDsn("https://k@sentry.example.test/prefix/7")?.envelopeUrl)
      .toBe("https://sentry.example.test/prefix/api/7/envelope/");
  });

  it("null se manca o non è valido", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("non-un-url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4507")).toBeNull();
  });
});

describe("buildCheckInEnvelope", () => {
  it("include stato, durata e monitor_config per creare il monitor", () => {
    const [, item, payload] = lines(
      buildCheckInEnvelope({ slug: "blog-auto-publish", schedule: "0 * * * *", marginMinutes: 15 }, "ok", "id1", 2.5),
    );
    expect(item).toEqual({ type: "check_in" });
    expect(payload).toMatchObject({
      check_in_id: "id1",
      monitor_slug: "blog-auto-publish",
      status: "ok",
      duration: 2.5,
      monitor_config: { schedule: { type: "crontab", value: "0 * * * *" }, timezone: "UTC", checkin_margin: 15 },
    });
  });

  it("senza durata per in_progress", () => {
    const [, , payload] = lines(buildCheckInEnvelope({ slug: "x", schedule: "* * * * *" }, "in_progress", "id2"));
    expect(payload).not.toHaveProperty("duration");
  });
});

describe("buildErrorEnvelope", () => {
  it("tagga runtime e funzione, con fingerprint opzionale", () => {
    const [, item, event] = lines(
      buildErrorEnvelope(new TypeError("boom"), { fn: "submit-booking", tags: { area: "cron" }, fingerprint: ["a", "b"] }),
    );
    expect(item).toEqual({ type: "event" });
    expect(event.tags).toEqual({ runtime: "edge", function: "submit-booking", area: "cron" });
    expect(event.fingerprint).toEqual(["a", "b"]);
    expect(event.exception.values[0]).toEqual({ type: "TypeError", value: "boom" });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("accetta anche valori che non sono Error", () => {
    const [, , event] = lines(buildErrorEnvelope({ code: 42 }, { fn: "f" }));
    expect(event.exception.values[0].value).toBe('{"code":42}');
  });
});

describe("withCronMonitor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stubDsn = () => {
    vi.stubGlobal("Deno", { env: { get: (k: string) => (k === "SENTRY_DSN" ? "https://k@o1.ingest.sentry.io/9" : undefined) } });
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const statuses = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map((c) => lines((c[1] as RequestInit).body as string)[2]).map((p) => p.status ?? p.level);

  it("in_progress poi ok se la risposta va bene", async () => {
    const fetchMock = stubDsn();
    const res = await withCronMonitor({ slug: "s", schedule: "0 * * * *" }, "f", async () => new Response("ok"));
    expect(res.status).toBe(200);
    expect(statuses(fetchMock)).toEqual(["in_progress", "ok"]);
  });

  it("error se la risposta è >= 400", async () => {
    const fetchMock = stubDsn();
    await withCronMonitor({ slug: "s", schedule: "0 * * * *" }, "f", async () => new Response("no", { status: 500 }));
    expect(statuses(fetchMock)).toEqual(["in_progress", "error"]);
  });

  it("su eccezione manda error ed evento, poi rilancia", async () => {
    const fetchMock = stubDsn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      withCronMonitor({ slug: "s", schedule: "0 * * * *" }, "f", async () => { throw new Error("x"); }),
    ).rejects.toThrow("x");
    expect(statuses(fetchMock).sort()).toEqual(["error", "error", "in_progress"]);
  });

  it("senza monitor nessun check-in", async () => {
    const fetchMock = stubDsn();
    await withCronMonitor(null, "f", async () => new Response("ok"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("senza DSN non chiama la rete", async () => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await withCronMonitor({ slug: "s", schedule: "0 * * * *" }, "f", async () => new Response("ok"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

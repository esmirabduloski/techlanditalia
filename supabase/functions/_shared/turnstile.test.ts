import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_BLOCKED_MESSAGE, turnstileGuard, type TurnstileSettings } from "./turnstile.ts";

const req = new Request("https://example.test", {
  headers: { "cf-connecting-ip": "1.2.3.4", "user-agent": "Mozilla/5.0" },
});

/** Finta risposta di siteverify. */
const siteverify = (body: Record<string, unknown>) =>
  vi.fn(async () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));

async function guard(token: unknown, settings: TurnstileSettings, fetchImpl: typeof fetch) {
  const logEvent = vi.fn(async () => undefined);
  const res = await turnstileGuard(req, {
    token,
    endpoint: "send-contact-email",
    identifier: "maria@example.com",
    logEvent,
    corsHeaders: { "Access-Control-Allow-Origin": "https://techlanditalia.it" },
    settings,
    fetchImpl,
  });
  return { res, logEvent };
}

const LOG_ONLY: TurnstileSettings = { secret: "segreto", enforce: false };
const ENFORCE: TurnstileSettings = { secret: "segreto", enforce: true };

describe("turnstileGuard", () => {
  it("senza secret è spento: niente chiamate a Cloudflare né log", async () => {
    const fetchImpl = siteverify({ success: false });
    const { res, logEvent } = await guard(undefined, { enforce: true }, fetchImpl);
    expect(res).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("token valido: passa e manda a Cloudflare secret, token e IP reale", async () => {
    const fetchImpl = siteverify({ success: true, "error-codes": [] });
    const { res, logEvent } = await guard("tok", ENFORCE, fetchImpl);
    expect(res).toBeNull();
    expect(logEvent).not.toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse(init.body as string)).toEqual({ secret: "segreto", response: "tok", remoteip: "1.2.3.4" });
  });

  it("solo log: token mancante registrato ma l'invio passa", async () => {
    const fetchImpl = siteverify({ success: true });
    const { res, logEvent } = await guard(undefined, LOG_ONLY, fetchImpl);
    expect(res).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "turnstile_missing",
      severity: "info",
      endpoint: "send-contact-email",
      identifier: "maria@example.com",
      ip_address: "1.2.3.4",
      metadata: { enforced: false },
    }));
  });

  it("blocco attivo: token rifiutato → 403 con messaggio per il visitatore", async () => {
    const { res, logEvent } = await guard("vecchio", ENFORCE, siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    expect(res?.status).toBe(403);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://techlanditalia.it");
    expect(await res?.json()).toEqual({ error: TURNSTILE_BLOCKED_MESSAGE });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "turnstile_failed",
      severity: "warn",
      metadata: { enforced: true, errors: ["timeout-or-duplicate"] },
    }));
  });

  it("blocco attivo: anche un token mancante o enorme viene respinto", async () => {
    const fetchImpl = siteverify({ success: true });
    expect((await guard("", ENFORCE, fetchImpl)).res?.status).toBe(403);
    expect((await guard(42, ENFORCE, fetchImpl)).res?.status).toBe(403);
    expect((await guard("x".repeat(2049), ENFORCE, fetchImpl)).res?.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Cloudflare irraggiungibile: l'invio passa e resta un evento di errore", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network down"); });
    const { res, logEvent } = await guard("tok", ENFORCE, fetchImpl as unknown as typeof fetch);
    expect(res).toBeNull();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "turnstile_unavailable",
      severity: "error",
      metadata: { detail: "network down" },
    }));
  });

  it("secret sbagliato: non blocca i visitatori", async () => {
    const { res, logEvent } = await guard("tok", ENFORCE, siteverify({ success: false, "error-codes": ["invalid-input-secret"] }));
    expect(res).toBeNull();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: "turnstile_unavailable" }));
  });

  it("errore HTTP di Cloudflare: non blocca", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    const { res } = await guard("tok", ENFORCE, fetchImpl);
    expect(res).toBeNull();
  });

  it("senza IP noto non manda remoteip", async () => {
    const fetchImpl = siteverify({ success: true });
    await turnstileGuard(new Request("https://example.test"), {
      token: "tok",
      endpoint: "parent-chat",
      logEvent: async () => undefined,
      corsHeaders: {},
      settings: ENFORCE,
      fetchImpl,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ secret: "segreto", response: "tok" });
  });
});

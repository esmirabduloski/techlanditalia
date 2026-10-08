import { describe, expect, it } from "vitest";
import { clientIp } from "./clientip.ts";

const req = (headers: Record<string, string>) => new Request("https://example.test", { headers });

describe("clientIp", () => {
  it("usa cf-connecting-ip anche se x-forwarded-for è falsificato", () => {
    expect(clientIp(req({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("senza Cloudflare ripiega su x-real-ip, poi x-forwarded-for", () => {
    expect(clientIp(req({ "x-real-ip": "5.5.5.5", "x-forwarded-for": "6.6.6.6" }))).toBe("5.5.5.5");
    expect(clientIp(req({ "x-forwarded-for": " 7.7.7.7 , 8.8.8.8" }))).toBe("7.7.7.7");
  });

  it("unknown se non c'è nessun header", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

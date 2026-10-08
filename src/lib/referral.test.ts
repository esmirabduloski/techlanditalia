import { describe, expect, it } from "vitest";
import { normalizeReferralCode } from "./referral";

describe("normalizeReferralCode", () => {
  it("maiuscolo e senza caratteri estranei", () => {
    expect(normalizeReferralCode("abc123")).toBe("ABC123");
    expect(normalizeReferralCode(" ab-c 12 ")).toBe("ABC12");
  });

  it("al massimo 16 caratteri", () => {
    expect(normalizeReferralCode("A".repeat(30))).toBe("A".repeat(16));
  });

  it("scarta codici troppo corti o vuoti", () => {
    expect(normalizeReferralCode("ab1")).toBeNull();
    expect(normalizeReferralCode("--")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it("i caratteri speciali non passano (il codice finisce in query e DB)", () => {
    expect(normalizeReferralCode("<script>abcd")).toBe("SCRIPTABCD");
  });
});

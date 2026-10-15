import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARENT_FALLBACK_UNTIL,
  fallbackDeadline,
  isWeakPasswordError,
  parentFallbackAllowed,
  validateChildPassword,
} from "./studentpassword";

describe("parentFallbackAllowed", () => {
  const before = new Date("2026-12-31T20:00:00Z");
  const after = new Date("2027-01-01T00:00:00Z");

  it("ammette lo studente legacy fino alla scadenza", () => {
    expect(parentFallbackAllowed(null, before, "2026-12-31")).toBe(true);
    expect(parentFallbackAllowed({ own_password: false }, before, "2026-12-31")).toBe(true);
  });

  it("lo nega dopo la scadenza", () => {
    expect(parentFallbackAllowed(null, after, "2026-12-31")).toBe(false);
  });

  it("lo nega a chi ha una password propria", () => {
    expect(parentFallbackAllowed({ own_password: true }, before, "2026-12-31")).toBe(false);
  });
});

describe("fallbackDeadline", () => {
  it("usa il default se la data manca o non è valida", () => {
    const def = fallbackDeadline(DEFAULT_PARENT_FALLBACK_UNTIL).getTime();
    expect(fallbackDeadline(undefined).getTime()).toBe(def);
    expect(fallbackDeadline("31/12/2026").getTime()).toBe(def);
    expect(fallbackDeadline("2026-13-45").getTime()).toBe(def);
  });

  it("chiude a fine giornata ora di Roma", () => {
    expect(fallbackDeadline("2026-11-30").toISOString()).toBe("2026-11-30T22:59:59.000Z");
  });
});

describe("validateChildPassword", () => {
  it("accetta una password con lettere e numeri", () => {
    expect(validateChildPassword("Gatto-Blu-42")).toBeNull();
  });

  it.each([
    [undefined, "Inserisci"],
    ["", "Inserisci"],
    ["abc12", "almeno 8"],
    ["abcdefgh", "lettera e un numero"],
    ["12345678", "lettera e un numero"],
    [" Gatto-Blu-42", "spazio"],
    ["a1".repeat(40), "al massimo"],
  ])("rifiuta %j", (pw, msg) => {
    expect(validateChildPassword(pw)).toContain(msg);
  });
});

describe("isWeakPasswordError", () => {
  it("riconosce gli errori di password debole", () => {
    expect(isWeakPasswordError({ code: "weak_password" })).toBe(true);
    expect(isWeakPasswordError({ message: "Password is known to be weak" })).toBe(true);
    expect(isWeakPasswordError({ message: "User not found" })).toBe(false);
    expect(isWeakPasswordError(null)).toBe(false);
  });
});

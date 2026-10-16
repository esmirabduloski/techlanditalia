import { describe, expect, it } from "vitest";
import { isWeakPasswordError, parentFallbackAllowed, validateChildPassword } from "./studentpassword";

describe("parentFallbackAllowed", () => {
  it("ammette lo studente legacy, senza scadenza", () => {
    expect(parentFallbackAllowed(null)).toBe(true);
    expect(parentFallbackAllowed(undefined)).toBe(true);
    expect(parentFallbackAllowed({ own_password: false })).toBe(true);
  });

  it("lo nega a chi ha una password propria", () => {
    expect(parentFallbackAllowed({ own_password: true })).toBe(false);
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

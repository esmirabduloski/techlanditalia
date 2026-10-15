import { describe, expect, it } from "vitest";
import { generateChildPassword, validateChildPassword } from "./childPassword";
import { validateChildPassword as serverValidate } from "../../supabase/functions/_shared/studentpassword";

describe("generateChildPassword", () => {
  it("genera password valide e leggibili", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateChildPassword();
      expect(pw).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
      expect(validateChildPassword(pw)).toBeNull();
    }
  });
});

describe("validateChildPassword", () => {
  it("dà gli stessi esiti del controllo nella edge function", () => {
    for (const pw of ["", "abc12", "abcdefgh", "12345678", " Gatto-Blu-42", "Gatto-Blu-42", "a1".repeat(40)]) {
      expect(validateChildPassword(pw)).toBe(serverValidate(pw));
    }
  });
});

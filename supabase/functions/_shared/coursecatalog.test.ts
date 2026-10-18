import { describe, expect, it } from "vitest";
import { courseCatalogLines } from "./coursecatalog.ts";

describe("courseCatalogLines", () => {
  it("elenca i corsi dal più piccolo con età, livello e durata del DB", () => {
    expect(
      courseCatalogLines([
        { title: "Python Base", age_range: "13+ anni", level: "base", duration: "8 mesi", description: "Le basi di Python" },
        { title: "Design creativo", age_range: "5-7 anni", level: "base", duration: null, description: null },
        { title: "Roblox Avanzato", age_range: "10+ anni", level: "avanzato", duration: null, description: " Giochi avanzati " },
      ]),
    ).toBe(
      [
        "- Design creativo (età 5-7 anni, livello Principiante)",
        "- Roblox Avanzato (età 10+ anni, livello Avanzato): Giochi avanzati",
        "- Python Base (età 13+ anni, livello Principiante, durata 8 mesi): Le basi di Python",
      ].join("\n"),
    );
  });

  it("senza corsi rimanda alla pagina /corsi", () => {
    expect(courseCatalogLines([])).toContain("/corsi");
  });
});

import { describe, expect, it } from "vitest";
import { discountStillValid, formatEuro, proposalMessage } from "./courseproposal.ts";

describe("formatEuro", () => {
  it("interi senza decimali, altrimenti con la virgola", () => {
    expect(formatEuro(5000)).toBe("50 €");
    expect(formatEuro(2550)).toBe("25,50 €");
    expect(formatEuro(0)).toBe("0 €");
  });
});

describe("discountStillValid", () => {
  it("vale fino al giorno di scadenza incluso", () => {
    expect(discountStillValid({ today: "2026-10-20", expiresOn: "2026-10-20", discountCents: 5000 })).toBe(true);
    expect(discountStillValid({ today: "2026-10-21", expiresOn: "2026-10-20", discountCents: 5000 })).toBe(false);
  });

  it("niente sconto se è zero o manca la scadenza", () => {
    expect(discountStillValid({ today: "2026-10-01", expiresOn: "2026-10-20", discountCents: 0 })).toBe(false);
    expect(discountStillValid({ today: "2026-10-01", expiresOn: null, discountCents: 5000 })).toBe(false);
  });
});

describe("proposalMessage", () => {
  const base = {
    parentName: "Maria Rossi",
    studentName: "Luca Rossi",
    teacherName: "Giulia",
    fromCourse: "Scratch",
    proposedCourse: "Python",
    reason: "  Ha capito bene i cicli ed è pronto per scrivere codice vero.  ",
    expiresOn: "2026-10-23",
  };

  it("con sconto: importo e scadenza in oggetto, push e testo", () => {
    const m = proposalMessage({ ...base, discountCents: 5000 });
    expect(m.subject).toBe("Il prossimo passo per Luca: Python (sconto di 50 €)");
    expect(m.pushBody).toContain("23/10/2026");
    expect(m.pushBody).toContain("50 €");
    expect(m.paragraphs[0]).toBe("Ciao Maria,");
    expect(m.paragraphs.join(" ")).toContain("sconto di 50 €");
    expect(m.quote).toBe("Ha capito bene i cicli ed è pronto per scrivere codice vero.");
  });

  it("senza sconto non lo nomina", () => {
    const m = proposalMessage({ ...base, parentName: null, discountCents: 0 });
    expect(m.subject).toBe("Il prossimo passo per Luca: Python");
    expect(m.paragraphs[0]).toBe("Ciao,");
    expect([m.pushBody, ...m.paragraphs].join(" ")).not.toContain("€");
  });
});

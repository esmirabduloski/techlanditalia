import { describe, expect, it } from "vitest";
import { isPrivateAreaPath } from "./privateAreas";

describe("isPrivateAreaPath", () => {
  it("aree con dati personali o di minori", () => {
    for (const p of ["/admin", "/admin/crm", "/area-riservata", "/area-riservata/lezione/1", "/insegnante/gruppo/x", "/auth", "/.lovable/oauth/consent"]) {
      expect(isPrivateAreaPath(p), p).toBe(true);
    }
  });

  it("pagine pubbliche, comprese le landing delle campagne", () => {
    for (const p of ["/", "/corsi", "/blog/python", "/lp/roblox", "/prenota", "/newsletter", "/administrator", "/authors"]) {
      expect(isPrivateAreaPath(p), p).toBe(false);
    }
  });

  it("accetta anche il percorso senza barra iniziale", () => {
    expect(isPrivateAreaPath("admin/crm")).toBe(true);
  });
});

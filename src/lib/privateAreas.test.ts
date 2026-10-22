import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPrivateAreaPath, PRIVATE_AREA_PREFIXES } from "./privateAreas";

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

describe("copie della lista in index.html", () => {
  it("gli snippet di GTM e Clarity escludono le stesse aree", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const copies = html.match(/\/\^\\\/\(([^)]*)\)\(\\\/\|\$\)\//g) ?? [];
    const expected = PRIVATE_AREA_PREFIXES.map((p) => p.slice(1).replace(".", "\\.")).join("|");
    expect(copies).toHaveLength(2);
    for (const copy of copies) expect(copy).toBe(`/^\\/(${expected})(\\/|$)/`);
  });
});

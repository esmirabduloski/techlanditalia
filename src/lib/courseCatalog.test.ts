import { describe, expect, it } from "vitest";
import { DB_TO_SHORT_SLUG, dbCourseSlug, publicCourseSlug } from "./courseCatalog";

describe("dbCourseSlug", () => {
  it("traduce solo i corsi che nel DB hanno ancora lo slug lungo", () => {
    expect(dbCourseSlug("scratch")).toBe("programmazione-visiva-con-scratch");
    expect(dbCourseSlug("minecraft")).toBe("programmazione-visiva-con-minecraft");
  });

  it("Roblox e Python AI hanno già lo slug corto nel DB", () => {
    expect(dbCourseSlug("roblox")).toBe("roblox");
    expect(dbCourseSlug("python-ai")).toBe("python-ai");
    expect(dbCourseSlug("python-base")).toBe("python-base");
  });
});

describe("slug lunghi storici", () => {
  it("reindirizzano tutti allo slug corto, anche quelli non più nel DB", () => {
    expect(DB_TO_SHORT_SLUG["programmazione-visiva-con-scratch"]).toBe("scratch");
    expect(DB_TO_SHORT_SLUG["programmazione-visiva-con-minecraft"]).toBe("minecraft");
    expect(DB_TO_SHORT_SLUG["sviluppo-giochi-con-roblox"]).toBe("roblox");
    expect(DB_TO_SHORT_SLUG["python-avanzato"]).toBe("python-ai");
  });

  it("i link pubblici usano sempre lo slug corto", () => {
    expect(publicCourseSlug("programmazione-visiva-con-scratch")).toBe("scratch");
    expect(publicCourseSlug("roblox")).toBe("roblox");
    expect(publicCourseSlug("design-creativo")).toBe("design-creativo");
  });
});

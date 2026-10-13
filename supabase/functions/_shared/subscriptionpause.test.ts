import { describe, expect, it } from "vitest";
import { daysBetween, pauseEndingMessage, reminderDue, romeToday, silencedProfileIds } from "./subscriptionpause.ts";

describe("reminderDue", () => {
  const base = { today: "2026-07-01", sent14: false, sent7: false };

  it("avvisi a 14 e 7 giorni", () => {
    expect(reminderDue({ ...base, endsOn: "2026-07-15" })).toBe(14);
    expect(reminderDue({ ...base, endsOn: "2026-07-08" })).toBe(7);
  });

  it("niente avviso fuori finestra, senza data o già inviato", () => {
    expect(reminderDue({ ...base, endsOn: "2026-07-16" })).toBeNull();
    expect(reminderDue({ ...base, endsOn: null })).toBeNull();
    expect(reminderDue({ ...base, endsOn: "2026-07-15", sent14: true })).toBeNull();
    expect(reminderDue({ ...base, endsOn: "2026-07-08", sent7: true })).toBeNull();
    expect(reminderDue({ ...base, endsOn: "2026-07-01" })).toBeNull();
  });

  it("recupera un giorno saltato mandando solo l'avviso più vicino", () => {
    expect(reminderDue({ ...base, endsOn: "2026-07-13" })).toBe(14);
    expect(reminderDue({ ...base, endsOn: "2026-07-05" })).toBe(7);
    expect(reminderDue({ ...base, endsOn: "2026-07-05", sent14: true })).toBe(7);
  });
});

describe("date", () => {
  it("giorni tra due date e oggi in Italia", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // cambio ora legale
    expect(romeToday(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});

describe("pauseEndingMessage", () => {
  it("testo a una settimana", () => {
    expect(pauseEndingMessage({ studentName: "Luca", endsOn: "2026-09-08", days: 7 })).toEqual({
      title: "⏯️ La pausa di Luca finisce tra una settimana",
      body: "Dal 08/09/2026 riprendono le lezioni di Luca con TECHLAND. Se vi serve più tempo o volete cambiare orario, scriveteci.",
    });
  });
});

describe("silencedProfileIds", () => {
  // Finto client: P1 ha S1 (in pausa) e S2 (attivo), P2 ha solo S3 (in pausa)
  const profiles = [
    { id: "S1", parent_id: "P1" },
    { id: "S2", parent_id: "P1" },
    { id: "S3", parent_id: "P2" },
  ];
  const fake = {
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const rows = table === "subscription_pauses"
        ? [{ student_id: "S1", ended_at: null, starts_on: "2026-01-01" }, { student_id: "S3", ended_at: null, starts_on: "2026-01-01" }]
        : profiles;
      const q = {
        select: () => q,
        is: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), q),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
        then: (resolve: (x: unknown) => void) =>
          resolve({ data: rows.filter((r) => filters.every((f) => f(r as Record<string, unknown>))), error: null }),
      };
      return q;
    },
  };

  it("studenti in pausa e genitori con tutti i figli in pausa", async () => {
    const ids = await silencedProfileIds(fake, new Date("2026-07-01T10:00:00Z"));
    expect([...ids].sort()).toEqual(["P2", "S1", "S3"]);
  });
});

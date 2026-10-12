import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, describeSignal, parseRules, planTask, type RiskSignal, toStored } from "./studentrisk.ts";

const now = new Date("2026-10-13T06:30:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const absences: RiskSignal = {
  kind: "consecutive_absences", group_id: "g1", group_title: "Python Junior", count: 2, dates: ["2026-10-01", "2026-10-08"],
};
const homework: RiskSignal = { kind: "missing_homework", count: 1, items: [{ title: "Il gioco del tris", due: "2026-10-10" }] };
const balance: RiskSignal = { kind: "low_balance", balance: 1, threshold: 2 };

describe("planTask", () => {
  const base = { open: null, lastClosed: null, now, cooldownDays: 14 };

  it("nessun segnale: non fa nulla", () => {
    expect(planTask({ ...base, signals: [] })).toEqual({ action: "none" });
  });

  it("primo segnale: crea l'attività", () => {
    expect(planTask({ ...base, signals: [absences] })).toEqual({ action: "create" });
  });

  it("attività aperta con gli stessi dati: non fa nulla", () => {
    // Come torna dal database: con key/label e chiavi riordinate da jsonb
    const stored = toStored([absences]).map((s) => Object.fromEntries(Object.entries(s).reverse())) as RiskSignal[];
    expect(planTask({ ...base, signals: [absences], open: { signals: stored } })).toEqual({ action: "none" });
  });

  it("attività aperta e un motivo nuovo: aggiorna e segnala il motivo", () => {
    expect(planTask({ ...base, signals: [absences, homework], open: { signals: [absences] } }))
      .toEqual({ action: "update", newReasons: [homework] });
  });

  it("attività aperta e dati cambiati senza motivi nuovi: aggiorna in silenzio", () => {
    const worse = { ...absences, count: 3, dates: [...absences.dates, "2026-10-12"] };
    expect(planTask({ ...base, signals: [worse], open: { signals: [absences] } }))
      .toEqual({ action: "update", newReasons: [] });
  });

  it("assenze in un altro gruppo contano come motivo nuovo", () => {
    const other = { ...absences, group_id: "g2" };
    expect(planTask({ ...base, signals: [other], open: { signals: [absences] } }))
      .toEqual({ action: "update", newReasons: [other] });
  });

  it("chiusa da poco con gli stessi motivi: non richiama", () => {
    const lastClosed = { signals: [absences, homework], completed_at: daysAgo(3), updated_at: daysAgo(3) };
    expect(planTask({ ...base, signals: [absences], lastClosed })).toEqual({ action: "cooldown" });
  });

  it("chiusa da poco ma con un motivo nuovo: crea", () => {
    const lastClosed = { signals: [absences], completed_at: daysAgo(3), updated_at: daysAgo(3) };
    expect(planTask({ ...base, signals: [absences, balance], lastClosed })).toEqual({ action: "create" });
  });

  it("chiusa da più del periodo di pausa: crea", () => {
    const lastClosed = { signals: [absences], completed_at: daysAgo(20), updated_at: daysAgo(20) };
    expect(planTask({ ...base, signals: [absences], lastClosed })).toEqual({ action: "create" });
  });
});

describe("describeSignal", () => {
  it("testi per il CRM", () => {
    expect(describeSignal(absences)).toBe("2 assenze di fila (Python Junior)");
    expect(describeSignal(homework)).toBe("Compito non consegnato: Il gioco del tris");
    expect(describeSignal({ ...homework, count: 3 })).toBe("3 compiti non consegnati");
    expect(describeSignal({ kind: "streak_broken", attendance: true, homework: false })).toBe("Streak presenze azzerata");
    expect(describeSignal({ kind: "streak_broken", attendance: true, homework: true })).toBe("Streak presenze e compiti azzerate");
    expect(describeSignal(balance)).toBe("Saldo basso: 1 lezione");
    expect(describeSignal({ ...balance, balance: 0 })).toBe("Lezioni del pacchetto esaurite");
  });
});

describe("parseRules", () => {
  it("default se mancano o non sono validi", () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES);
    expect(parseRules({ absences_in_a_row: "x", cooldown_days: -5 })).toEqual({ ...DEFAULT_RULES, cooldown_days: 0 });
  });

  it("saldo disattivato con null", () => {
    expect(parseRules({ low_balance_threshold: null, enabled: false })).toEqual({
      ...DEFAULT_RULES, low_balance_threshold: null, enabled: false,
    });
  });
});

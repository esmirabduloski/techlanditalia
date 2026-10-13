import { describe, expect, it } from "vitest";
import {
  buildReportEmail,
  delta,
  highlights,
  isMonth,
  monthLabel,
  monthRange,
  type MonthlyStats,
  previousMonth,
  reportMonth,
} from "./monthlyreport.ts";

function stats(over: Partial<{ [K in keyof MonthlyStats]: Partial<MonthlyStats[K]> }> = {}): MonthlyStats {
  const base: MonthlyStats = {
    from: "2026-09-01",
    to: "2026-10-01",
    enrollments: { families_won: 4, new_students: 5 },
    cancellations: { total: 1, whole_family: 0, by_reason: [{ reason: "cost", count: 1 }], would_return: { yes: 0, maybe: 1, no: 0 } },
    revenue: { paid_cents: 100_000, paid_count: 10, unpaid_cents: 0, unpaid_count: 0 },
    trials: { requested: 6, completed: 4, cancelled: 1, converted: 2 },
    conversion: { won: 4, lost: 4 },
    satisfaction: {
      surveys: { sent: 10, answered: 8, promoters: 5, detractors: 1, avg_score: 8.6 },
      attendance_marked: 40, attendance_present: 36, attendance_justified: 2, at_risk_flagged: 1 },
    active_students: 30,
  };
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === "object" && v !== null ? { ...(base as Record<string, object>)[k], ...v } : v;
  }
  return out as MonthlyStats;
}

describe("mesi", () => {
  it("il 1° del mese il report è del mese prima, in ora italiana", () => {
    expect(reportMonth(new Date("2026-10-01T06:00:00Z"))).toBe("2026-09");
    // 23:30 UTC del 31 dicembre è già il 1° gennaio in Italia
    expect(reportMonth(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12");
    expect(reportMonth(new Date("2027-01-01T06:00:00Z"))).toBe("2026-12");
  });

  it("intervalli e mese precedente a cavallo d'anno", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(monthLabel("2026-09")).toBe("settembre 2026");
  });

  it("valida il formato del mese", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-9")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });
});

describe("delta", () => {
  it("colore secondo il verso buono", () => {
    expect(delta(5, 3)).toEqual({ text: "+2", tone: "good" });
    expect(delta(3, 5, { higherIsBetter: false })).toEqual({ text: "−2", tone: "good" });
    expect(delta(5, 3, { higherIsBetter: false })).toEqual({ text: "+2", tone: "bad" });
    expect(delta(4, 4)).toEqual({ text: "=", tone: "neutral" });
    expect(delta(null, 4)).toBeNull();
  });
});

describe("highlights", () => {
  it("segnala calo degli incassi, rate da incassare e più disdette che iscrizioni", () => {
    const cur = stats({
      revenue: { paid_cents: 70_000, unpaid_cents: 12_000, unpaid_count: 2 },
      enrollments: { families_won: 1 },
      cancellations: { total: 3, by_reason: [{ reason: "schedule", count: 2 }, { reason: "cost", count: 1 }] },
    });
    const out = highlights("2026-09", cur, stats());
    expect(out).toContain("Incassi in calo del 30% rispetto ad agosto.");
    expect(out.some((s) => s.startsWith("2 rate con scadenza a settembre"))).toBe(true);
    expect(out).toContain("Più disdette (3) che nuove famiglie iscritte (1).");
    expect(out).toContain("Motivo di disdetta più frequente: Orari / giorni delle lezioni (2).");
  });

  it("niente da notare in un mese normale", () => {
    const calm = stats({ satisfaction: { surveys: { sent: 10, answered: 8, promoters: 5, detractors: 0, avg_score: 9 } } });
    expect(highlights("2026-09", calm, calm)).toEqual([]);
  });

  it("segnala il calo dell'NPS e i voti bassi", () => {
    const cur = stats({ satisfaction: { surveys: { sent: 10, answered: 10, promoters: 3, detractors: 3, avg_score: 7 } } });
    const out = highlights("2026-09", cur, stats());
    // 50 → 0
    expect(out).toContain("NPS sceso da 50 a 0: guarda i commenti dei voti bassi nel CRM.");
    expect(out).toContain("3 famiglie hanno dato un voto da 0 a 6 nel sondaggio di gradimento.");
  });
});

describe("buildReportEmail", () => {
  it("contiene tutte le sezioni e i numeri principali", () => {
    const { subject, html, text } = buildReportEmail({
      month: "2026-09",
      cur: stats(),
      prev: stats({ enrollments: { families_won: 2 }, conversion: { won: 2, lost: 6 } }),
      siteUrl: "https://techlanditalia.it/",
    });
    expect(subject).toBe("📊 Report di settembre 2026 · TECHLAND");
    for (const s of ["Iscrizioni", "Disdette", "Incassi", "Lezioni di prova", "Conversione", "Soddisfazione"]) {
      expect(html).toContain(s);
    }
    expect(text).toContain("Nuove famiglie iscritte: 4 (+2)");
    expect(text).toContain("Tasso di conversione: 50% (+25 pt)");
    expect(text).toContain("Presenza media alle lezioni: 90%");
    expect(text).toContain("NPS (sondaggio di gradimento): +50 (=) — 5 promotori · 1 detrattori");
    expect(text).toContain("Voto medio: 8,6 / 10 — 8 risposte · 80% di risposta sui 10 inviati");
    expect(text).toMatch(/Incassato: 1\.000,00\s€/);
    expect(html).toContain('href="https://techlanditalia.it/admin/crm"');
  });

  it("senza lead chiusi la conversione è un trattino, senza confronto", () => {
    const { text } = buildReportEmail({
      month: "2026-09",
      cur: stats({ conversion: { won: 0, lost: 0 } }),
      prev: stats(),
      siteUrl: "https://techlanditalia.it",
    });
    expect(text).toContain("Tasso di conversione: — — 0 acquisiti su 0 lead chiusi");
  });

  it("sondaggio assente o senza risposte", () => {
    const off = buildReportEmail({
      month: "2026-09",
      cur: stats({ satisfaction: { surveys: null } }),
      prev: stats({ satisfaction: { surveys: null } }),
      siteUrl: "https://techlanditalia.it",
    }).text;
    expect(off).not.toContain("NPS");
    expect(off).toContain("Sondaggio di gradimento non attivo");

    const empty = buildReportEmail({
      month: "2026-09",
      cur: stats({ satisfaction: { surveys: { sent: 4, answered: 0, promoters: 0, detractors: 0, avg_score: null } } }),
      prev: stats(),
      siteUrl: "https://techlanditalia.it",
    }).text;
    expect(empty).toContain("Sondaggio di gradimento: Nessuna risposta — 4 inviati nel mese");
  });
});

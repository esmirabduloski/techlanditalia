import { describe, expect, it } from "vitest";
import {
  addDays,
  forecastDataRetention,
  forecastMonthlyReport,
  forecastPauses,
  forecastPayments,
  nextRunDate,
  sortUpcoming,
  type ForecastPause,
  type ForecastPayment,
} from "./emailforecast.ts";
import { DEFAULT_DUNNING } from "./paymentreminders.ts";

// 19 ottobre 2026, 10:00 a Roma (ora legale): il job delle 07:00 UTC di oggi è già passato
const NOW = new Date("2026-10-19T08:00:00Z");

const payment = (over: Partial<ForecastPayment> = {}): ForecastPayment => ({
  id: "p1",
  amount_cents: 8900,
  description: "Corso Python Base",
  due_date: "2026-11-05",
  reminder_date: "2026-11-02",
  installment_number: 3,
  installment_total: 10,
  remind_client: true,
  client_reminder_sent_at: null,
  overdue_reminder_count: 0,
  last_overdue_reminder_at: null,
  crm_leads: { full_name: "Anna Rossi", email: "anna@example.com", linked_profile_id: null },
  ...over,
});

const rules = { ...DEFAULT_DUNNING, notify_client: true };

describe("nextRunDate", () => {
  it("oggi se il job deve ancora girare, altrimenti domani", () => {
    expect(nextRunDate(new Date("2026-10-19T06:59:00Z"), "07:00")).toBe("2026-10-19");
    expect(nextRunDate(new Date("2026-10-19T07:00:00Z"), "07:00")).toBe("2026-10-20");
  });

  it("usa la data di Roma: alle 00:30 di Roma è già il giorno dopo", () => {
    expect(nextRunDate(new Date("2026-10-19T22:30:00Z"), "07:00")).toBe("2026-10-20");
  });

  it("addDays attraversa il cambio dell'ora", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("forecastPayments", () => {
  const base = { now: NOW, days: 30, pushUsers: new Set<string>(), silenced: new Set<string>() };

  it("promemoria nel giorno del promemoria, poi i solleciti secondo le regole", () => {
    const out = forecastPayments({ ...base, payments: [payment()], rules });
    expect(out.map((o) => [o.kind, o.scheduledFor.slice(0, 10)])).toEqual([
      ["payment_reminder", "2026-11-02"],
      ["payment_overdue", "2026-11-08"],
      ["payment_overdue", "2026-11-15"],
    ]);
    expect(out[0].scheduledFor).toBe("2026-11-02T07:00:00.000Z");
    expect(out[0].description).toBe("La rata 3/10 (Corso Python Base) di 89,00\u00a0€ in scadenza il 05/11");
    expect(out[1].description).toMatch(/^Sollecito 1\/3: la rata 3\/10/);
    expect(out[0].channel).toBe("email");
  });

  it("niente solleciti se l'avviso al cliente è spento", () => {
    const out = forecastPayments({ ...base, payments: [payment()], rules: DEFAULT_DUNNING });
    expect(out.map((o) => o.kind)).toEqual(["payment_reminder"]);
  });

  it("riprende dal conteggio e dall'ultimo sollecito, fino al massimo", () => {
    const out = forecastPayments({
      ...base,
      payments: [payment({
        due_date: "2026-10-01",
        client_reminder_sent_at: "2026-09-28T07:00:00Z",
        overdue_reminder_count: 2,
        last_overdue_reminder_at: "2026-10-15T07:00:00Z",
      })],
      rules,
    });
    expect(out.map((o) => [o.kind, o.scheduledFor.slice(0, 10)])).toEqual([["payment_overdue", "2026-10-22"]]);
    expect(out[0].description).toMatch(/^Sollecito 3\/3/);
  });

  it("un promemoria arretrato parte al prossimo giro, se non è troppo vecchio", () => {
    const recent = forecastPayments({ ...base, payments: [payment({ reminder_date: "2026-10-18" })], rules: DEFAULT_DUNNING });
    expect(recent[0].scheduledFor.slice(0, 10)).toBe("2026-10-20");
    const old = forecastPayments({ ...base, payments: [payment({ reminder_date: "2026-10-10" })], rules: DEFAULT_DUNNING });
    expect(old).toEqual([]);
  });

  it("fuori finestra o promemoria già mandato: niente", () => {
    expect(forecastPayments({ ...base, days: 7, payments: [payment()], rules })).toEqual([]);
    expect(forecastPayments({
      ...base,
      payments: [payment({ client_reminder_sent_at: "2026-10-01T07:00:00Z" })],
      rules: DEFAULT_DUNNING,
    })).toEqual([]);
  });

  it("canale: push con l'app, email in pausa o senza app, nessuno senza email", () => {
    const linked = payment({ crm_leads: { full_name: "Anna", email: "anna@example.com", linked_profile_id: "u1" } });
    const withApp = { ...base, pushUsers: new Set(["u1"]), rules: DEFAULT_DUNNING };
    expect(forecastPayments({ ...withApp, payments: [linked] })[0].channel).toBe("push");
    expect(forecastPayments({ ...withApp, silenced: new Set(["u1"]), payments: [linked] })[0].channel).toBe("email");
    const noEmail = payment({ crm_leads: { full_name: "Anna", email: null, linked_profile_id: null } });
    expect(forecastPayments({ ...base, rules: DEFAULT_DUNNING, payments: [noEmail] })[0].channel).toBe("none");
  });
});

describe("forecastPauses", () => {
  const pause = (over: Partial<ForecastPause> = {}): ForecastPause => ({
    ends_on: "2026-11-09",
    reminder_14_sent_at: null,
    reminder_7_sent_at: null,
    studentName: "Luca Rossi",
    recipientId: "p1",
    recipientName: "Anna Rossi",
    recipientEmail: "anna@example.com",
    ...over,
  });

  it("avvisi a 14 e 7 giorni dalla ripresa", () => {
    const out = forecastPauses({ pauses: [pause()], now: NOW, days: 30, pushUsers: new Set(["p1"]) });
    expect(out.map((o) => o.scheduledFor.slice(0, 10))).toEqual(["2026-10-26", "2026-11-02"]);
    expect(out[0].description).toBe("Le lezioni riprendono il 09/11/2026 (avviso a 14 giorni)");
    expect(out[0].channel).toBe("push_email");
  });

  it("dentro i 14 giorni manda solo quello dei 7, come il job", () => {
    const out = forecastPauses({ pauses: [pause({ ends_on: "2026-10-25" })], now: NOW, days: 30, pushUsers: new Set() });
    expect(out.map((o) => [o.scheduledFor.slice(0, 10), o.description])).toEqual([
      ["2026-10-20", "Le lezioni riprendono il 25/10/2026 (avviso a 7 giorni)"],
    ]);
  });

  it("niente doppioni per gli avvisi già mandati", () => {
    const out = forecastPauses({
      pauses: [pause({ reminder_14_sent_at: "2026-10-26T07:00:00Z" })],
      now: NOW,
      days: 30,
      pushUsers: new Set(),
    });
    expect(out.map((o) => o.scheduledFor.slice(0, 10))).toEqual(["2026-11-02"]);
    expect(out[0].channel).toBe("email");
  });
});

describe("job mensili", () => {
  const admins = [{ name: "Admin", email: "admin@example.com" }];

  it("report mensile il 1° alle 06:00 UTC, salvo mese già inviato", () => {
    const out = forecastMonthlyReport({ now: NOW, days: 30, admins, sentMonths: new Set() });
    expect(out.map((o) => [o.scheduledFor, o.description])).toEqual([["2026-11-01T06:00:00.000Z", "Report di ottobre 2026"]]);
    expect(forecastMonthlyReport({ now: NOW, days: 30, admins, sentMonths: new Set(["2026-10"]) })).toEqual([]);
  });

  it("il 1° del mese dopo le 06:00 UTC il job di oggi non conta più", () => {
    const out = forecastMonthlyReport({ now: new Date("2026-11-01T09:00:00Z"), days: 10, admins, sentMonths: new Set() });
    expect(out).toEqual([]);
  });

  it("pulizia dati: una riga con tutti i destinatari, nessuna senza destinatari", () => {
    const out = forecastDataRetention({ now: NOW, days: 60, recipients: ["a@x.it", "b@x.it"] });
    expect(out.map((o) => o.scheduledFor.slice(0, 10))).toEqual(["2026-11-01", "2026-12-01"]);
    expect(out[0].recipientEmail).toBe("a@x.it, b@x.it");
    expect(forecastDataRetention({ now: NOW, days: 75, recipients: [] })).toEqual([]);
  });
});

describe("sortUpcoming", () => {
  it("ordina per data e poi per tipo", () => {
    const out = sortUpcoming([
      ...forecastDataRetention({ now: NOW, days: 20, recipients: ["a@x.it"] }),
      ...forecastPauses({
        pauses: [{ ends_on: "2026-11-09", reminder_14_sent_at: null, reminder_7_sent_at: null, studentName: "L", recipientId: "x", recipientName: null, recipientEmail: null }],
        now: NOW,
        days: 20,
        pushUsers: new Set(),
      }),
    ]);
    expect(out.map((o) => o.kind)).toEqual(["pause_ending", "staff_data_retention", "pause_ending"]);
  });
});

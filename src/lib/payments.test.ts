import { describe, expect, it } from "vitest";
import {
  computeBulkUpdate,
  daysBetween,
  getClientChannel,
  parseEuroToCents,
  paymentLabel,
  paymentPhrase,
  paymentWhatsAppLink,
  planInstallments,
} from "./payments";

describe("parseEuroToCents", () => {
  it("accetta i formati che scrive un admin", () => {
    expect(parseEuroToCents("80")).toBe(8000);
    expect(parseEuroToCents("80,50")).toBe(8050);
    expect(parseEuroToCents("80.5")).toBe(8050);
    expect(parseEuroToCents(" 80 € ")).toBe(8000);
    expect(parseEuroToCents("1.200,00")).toBe(120000);
  });

  it("evita gli errori di arrotondamento dei decimali", () => {
    expect(parseEuroToCents("19,99")).toBe(1999);
    expect(parseEuroToCents("0,1")).toBe(10);
  });

  it("rifiuta valori vuoti, negativi o non numerici", () => {
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("   ")).toBeNull();
    expect(parseEuroToCents("-10")).toBeNull();
    expect(parseEuroToCents("abc")).toBeNull();
  });
});

describe("planInstallments", () => {
  it("rate mensili: a fine mese non salta febbraio", () => {
    const plan = planInstallments(3, "2026-01-31", "monthly", 0);
    expect(plan.map((p) => p.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("numera le rate da 1", () => {
    expect(planInstallments(3, "2026-09-01", "monthly", 0).map((p) => p.number)).toEqual([1, 2, 3]);
  });

  it("rate ogni 2 settimane e ogni settimana", () => {
    expect(planInstallments(3, "2026-09-01", "biweekly", 0).map((p) => p.dueDate))
      .toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]);
    expect(planInstallments(3, "2026-09-01", "weekly", 0).map((p) => p.dueDate))
      .toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("promemoria spostato rispetto alla scadenza, anche a cavallo del mese", () => {
    const [first] = planInstallments(1, "2026-10-02", "monthly", -3);
    expect(first.reminderDate).toBe("2026-09-29");
    const [late] = planInstallments(1, "2026-10-30", "monthly", 3);
    expect(late.reminderDate).toBe("2026-11-02");
  });

  it("nessuna rata se il numero è 0", () => {
    expect(planInstallments(0, "2026-09-01", "monthly", 0)).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("conta i giorni di calendario, anche col cambio dell'ora legale", () => {
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("paymentPhrase e paymentLabel", () => {
  const rata = { installment_number: 3, installment_total: 10, description: "Corso Python" };
  const singolo = { installment_number: null, installment_total: null, description: "Corso Scratch" };
  const vuoto = { installment_number: null, installment_total: null, description: null };

  it("frase per il messaggio al cliente", () => {
    expect(paymentPhrase(rata)).toBe("la rata 3/10 (Corso Python)");
    expect(paymentPhrase(singolo)).toBe("il pagamento per Corso Scratch");
    expect(paymentPhrase(vuoto)).toBe("il pagamento");
  });

  it("etichetta nelle liste admin", () => {
    expect(paymentLabel(rata)).toBe("Rata 3/10 · Corso Python");
    expect(paymentLabel(singolo)).toBe("Corso Scratch");
    expect(paymentLabel(vuoto)).toBe("Pagamento");
  });
});

describe("paymentWhatsAppLink", () => {
  const payment = {
    amount_cents: 8000,
    due_date: "2026-10-10",
    installment_number: 2,
    installment_total: 10,
    description: "Corso Roblox",
  };
  const text = (link: string | null) => decodeURIComponent(new URL(link!).searchParams.get("text")!);

  it("niente link senza numero di telefono", () => {
    expect(paymentWhatsAppLink({ phone: null, full_name: "Mario Rossi" }, payment, "2026-10-08")).toBeNull();
    expect(paymentWhatsAppLink({ phone: "  ", full_name: "Mario Rossi" }, payment, "2026-10-08")).toBeNull();
  });

  it("toglie spazi e simboli dal numero", () => {
    const link = paymentWhatsAppLink({ phone: "+39 333 123-4567", full_name: null }, payment, "2026-10-08");
    expect(link).toMatch(/^https:\/\/wa\.me\/393331234567\?text=/);
  });

  it("promemoria prima della scadenza, col solo nome di battesimo", () => {
    const t = text(paymentWhatsAppLink({ phone: "3331234567", full_name: "Mario Rossi" }, payment, "2026-10-08"));
    expect(t).toContain("Ciao Mario, ti scrivo da TECHLAND per ricordarti la rata 2/10 (Corso Roblox)");
    expect(t).toContain("in scadenza il 10/10/2026");
    expect(t).not.toContain("ancora da saldare");
  });

  it("sollecito dopo la scadenza", () => {
    const t = text(paymentWhatsAppLink({ phone: "3331234567", full_name: "Mario Rossi" }, payment, "2026-10-11"));
    expect(t).toContain("risulta ancora da saldare");
    expect(t).toContain("Se hai già pagato, ignora pure questo messaggio");
  });

  it("il giorno della scadenza è ancora un promemoria, non un sollecito", () => {
    const t = text(paymentWhatsAppLink({ phone: "3331234567", full_name: null }, payment, "2026-10-10"));
    expect(t).not.toContain("ancora da saldare");
  });
});

describe("getClientChannel", () => {
  it("push se ha l'account con notifiche (o non si sa ancora)", () => {
    expect(getClientChannel(true, true, "a@b.it")).toMatchObject({ canNotify: true, warn: false });
    expect(getClientChannel(true, null, null)).toMatchObject({ canNotify: true, warn: false });
  });

  it("email se non ha le notifiche o l'app", () => {
    expect(getClientChannel(true, false, "a@b.it").hint).toContain("Non ha le notifiche attive");
    expect(getClientChannel(false, null, "a@b.it").hint).toContain("Non ha l'app");
  });

  it("avviso se non c'è nessun canale", () => {
    expect(getClientChannel(false, null, null)).toMatchObject({ canNotify: false, warn: true });
    expect(getClientChannel(true, false, "")).toMatchObject({ canNotify: false, warn: true });
  });
});

describe("computeBulkUpdate (sconti sulle rate)", () => {
  const rata = { id: "r1", amount_cents: 10000, list_amount_cents: null };
  const giaScontata = { id: "r2", amount_cents: 9000, list_amount_cents: 10000 };

  it("sconto fratelli 10% sul prezzo pieno", () => {
    expect(computeBulkUpdate(rata, "percent", "10", "Sconto fratelli 10%")).toEqual({
      id: "r1",
      amount_cents: 9000,
      list_amount_cents: 10000,
      discount_label: "Sconto fratelli 10%",
    });
  });

  it("un nuovo sconto sostituisce il precedente, non si somma", () => {
    // 20% su 100 € = 80 €, non 20% sui 90 € già scontati (72 €)
    expect(computeBulkUpdate(giaScontata, "percent", "20", "")?.amount_cents).toBe(8000);
  });

  it("etichetta automatica se non ne viene scritta una", () => {
    expect(computeBulkUpdate(rata, "percent", "15", "  ")?.discount_label).toBe("Sconto 15%");
    expect(computeBulkUpdate(rata, "fixed", "25", "")?.discount_label).toMatch(/^Sconto 25,00\s€$/);
  });

  it("sconto fisso, con la virgola decimale", () => {
    expect(computeBulkUpdate(rata, "fixed", "12,50", "")?.amount_cents).toBe(8750);
  });

  it("l'importo non va mai sotto zero", () => {
    expect(computeBulkUpdate(rata, "fixed", "500", "")?.amount_cents).toBe(0);
    expect(computeBulkUpdate(rata, "percent", "150", "")?.amount_cents).toBe(0);
  });

  it("rimuovere lo sconto riporta al prezzo pieno", () => {
    expect(computeBulkUpdate(giaScontata, "remove", "", "")).toEqual({
      id: "r2",
      amount_cents: 10000,
      list_amount_cents: null,
      discount_label: null,
    });
  });

  it("nuovo prezzo: azzera lo sconto", () => {
    expect(computeBulkUpdate(giaScontata, "price", "95", "")).toEqual({
      id: "r2",
      amount_cents: 9500,
      list_amount_cents: null,
      discount_label: null,
    });
  });

  it("valori non validi bloccano la modifica", () => {
    expect(computeBulkUpdate(rata, "price", "", "")).toBeNull();
    expect(computeBulkUpdate(rata, "price", "0", "")).toBeNull();
    expect(computeBulkUpdate(rata, "percent", "0", "")).toBeNull();
    expect(computeBulkUpdate(rata, "percent", "-5", "")).toBeNull();
    expect(computeBulkUpdate(rata, "fixed", "abc", "")).toBeNull();
  });
});

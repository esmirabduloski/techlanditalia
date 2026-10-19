import { describe, expect, it } from "vitest";
import {
  clientTexts,
  DEFAULT_DUNNING,
  parseDunning,
  paymentEmail,
  paymentPhrase,
  paymentReference,
  type PaymentForText,
} from "./paymentreminders.ts";

const p: PaymentForText = {
  amount_cents: 8900,
  description: "Corso Python Base",
  due_date: "2026-11-05",
  installment_number: 3,
  installment_total: 10,
  crm_leads: { full_name: "Anna Rossi", linked_profile_id: null },
};

describe("testi dei pagamenti", () => {
  it("frase e causale della rata", () => {
    expect(paymentPhrase(p)).toBe("la rata 3/10 (Corso Python Base)");
    expect(paymentPhrase({ ...p, installment_number: null })).toBe("il pagamento per Corso Python Base");
    expect(paymentPhrase({ ...p, installment_number: null, description: null })).toBe("il pagamento");
    expect(paymentReference(p)).toBe("Corso educativo per bambini - rata 3/10");
  });

  it("promemoria e sollecito", () => {
    expect(clientTexts(p, "reminder")).toEqual({
      title: "Promemoria pagamento",
      text: "Ciao Anna, ti ricordiamo la rata 3/10 (Corso Python Base) di 89,00\u00a0€ in scadenza il 05/11. Grazie!",
    });
    expect(clientTexts({ ...p, crm_leads: null }, "overdue").text)
      .toBe("Risulta ancora da saldare la rata 3/10 (Corso Python Base) di 89,00\u00a0€, con scadenza il 05/11. Se hai già pagato, ignora questo messaggio. Grazie!");
  });

  it("email: oggetto, istruzioni, link all'area riservata solo con account", () => {
    const mail = paymentEmail(p, "reminder", { siteUrl: "https://techlanditalia.it", instructions: "IBAN <IT00>" });
    expect(mail.subject).toBe("Promemoria pagamento – 89,00\u00a0€");
    expect(mail.html).toContain("IBAN &lt;IT00&gt;");
    expect(mail.html).not.toContain("/area-riservata/acquisti");
    expect(mail.text).toContain("Causale: Corso educativo per bambini - rata 3/10");
    const withAccount = paymentEmail({ ...p, crm_leads: { full_name: "Anna", linked_profile_id: "u1" } }, "overdue", {
      siteUrl: "https://techlanditalia.it",
    });
    expect(withAccount.html).toContain("https://techlanditalia.it/area-riservata/acquisti");
    expect(withAccount.html).toContain("contattaci su WhatsApp");
  });

  it("regole dei solleciti con i default", () => {
    expect(parseDunning(null)).toEqual(DEFAULT_DUNNING);
    expect(parseDunning({ notify_client: true, max_reminders: 5 })).toEqual({ ...DEFAULT_DUNNING, notify_client: true, max_reminders: 5 });
  });
});

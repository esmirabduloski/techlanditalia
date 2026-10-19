/**
 * Promemoria e solleciti dei pagamenti CRM (send-payment-reminders): regole dei
 * solleciti e testi per il cliente (push ed email). Funzioni pure, usate anche
 * dalle previsioni e dagli esempi del centro di controllo /admin/email.
 */
import { brandedEmail, escapeHtml, type EmailContent } from "./emaillayout.ts";

export type DunningSettings = {
  enabled: boolean;
  first_after_days: number;
  repeat_every_days: number;
  max_reminders: number;
  notify_client: boolean;
  /** Testo aggiunto alle email al cliente, es. IBAN o modalità di pagamento */
  payment_instructions?: string;
};

export const DEFAULT_DUNNING: DunningSettings = {
  enabled: true,
  first_after_days: 3,
  repeat_every_days: 7,
  max_reminders: 3,
  notify_client: false,
};

/** Regole da site_settings.crm_payment_dunning, con i default per i campi mancanti. */
export function parseDunning(value: unknown): DunningSettings {
  return { ...DEFAULT_DUNNING, ...((value as Partial<DunningSettings> | null) ?? {}) };
}

// Al cliente non mandiamo promemoria troppo vecchi (es. rate create con date già passate)
export const CLIENT_MAX_DELAY_DAYS = 3;
// Stesso numero del footer e di WhatsAppCta.tsx
export const WHATSAPP_NUMBER = "393505813140";

/** Campi della rata che servono ai testi. */
export type PaymentForText = {
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  installment_number: number | null;
  installment_total: number | null;
  crm_leads: { full_name: string | null; linked_profile_id: string | null } | null;
};

export type PaymentKind = "reminder" | "overdue";

export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

export const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : "";

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "la rata 3/10 (Corso Python Base)", "il pagamento per Corso Scratch", "il pagamento". */
export function paymentPhrase(p: PaymentForText): string {
  const desc = p.description?.trim();
  if (p.installment_number && p.installment_total) {
    return `la rata ${p.installment_number}/${p.installment_total}${desc ? ` (${desc})` : ""}`;
  }
  return desc ? `il pagamento per ${desc}` : "il pagamento";
}

/** Causale del bonifico: "Corso educativo per bambini - rata 3/10". */
export function paymentReference(p: PaymentForText): string {
  const base = "Corso educativo per bambini";
  if (!p.installment_number) return base;
  return `${base} - rata ${p.installment_number}${p.installment_total ? `/${p.installment_total}` : ""}`;
}

/** Titolo e testo per il cliente (push ed email). */
export function clientTexts(p: PaymentForText, kind: PaymentKind): { title: string; text: string } {
  const firstName = p.crm_leads?.full_name?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Ciao ${firstName}, ` : "";
  const title = kind === "overdue" ? "Pagamento da saldare" : "Promemoria pagamento";
  const text = kind === "overdue"
    ? `${greeting}${firstName ? "risulta" : "Risulta"} ancora da saldare ${paymentPhrase(p)} di ${euro(p.amount_cents)}${p.due_date ? `, con scadenza il ${shortDate(p.due_date)}` : ""}. Se hai già pagato, ignora questo messaggio. Grazie!`
    : `${greeting}${firstName ? "ti" : "Ti"} ricordiamo ${paymentPhrase(p)} di ${euro(p.amount_cents)}${p.due_date ? ` in scadenza il ${shortDate(p.due_date)}` : ""}. Grazie!`;
  return { title, text };
}

/** Email al cliente (quando la push non è possibile). */
export function paymentEmail(
  p: PaymentForText,
  kind: PaymentKind,
  opts: { siteUrl: string; instructions?: string | null },
): EmailContent {
  const { title, text } = clientTexts(p, kind);
  const instructions = opts.instructions?.trim();
  const hasAccount = !!p.crm_leads?.linked_profile_id;
  const reference = paymentReference(p);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Ciao! Vi scrivo per ${paymentPhrase(p)} di ${euro(p.amount_cents)}.`)}`;
  const bodyHtml = `<p style="margin:0 0 16px;">${escapeHtml(text)}</p>
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f0fdf4;border-radius:12px;margin:0 0 16px;">
  <tr><td style="padding:16px;font-size:15px;">
  <strong>Importo:</strong> ${escapeHtml(euro(p.amount_cents))}<br>
  ${p.due_date ? `<strong>Scadenza:</strong> ${escapeHtml(longDate(p.due_date))}<br>` : ""}
  ${p.description ? `<strong>Descrizione:</strong> ${escapeHtml(p.description)}<br>` : ""}
  <strong>Causale:</strong> ${escapeHtml(reference)}
  </td></tr></table>
  ${instructions ? `<p style="margin:0 0 16px;white-space:pre-line;"><strong>Come pagare</strong><br>${escapeHtml(instructions)}</p>` : ""}
  ${hasAccount ? `<p style="margin:0 0 16px;"><a href="${opts.siteUrl}/area-riservata/acquisti" style="color:#059669;font-weight:bold;">Vedi i tuoi pagamenti nell'area riservata →</a></p>` : ""}`;
  return {
    subject: `${title} – ${euro(p.amount_cents)}`,
    html: brandedEmail({
      title,
      bodyHtml,
      closingHtml: `<p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email, ma per risposte immediate <a href="${whatsappUrl}" style="color:#059669;font-weight:bold;">contattaci su WhatsApp</a>.</p>`,
    }),
    text: `${text}\n\nCausale: ${reference}${instructions ? `\n\nCome pagare:\n${instructions}` : ""}\n\nPer qualsiasi dubbio rispondi pure a questa email, ma per risposte immediate contattaci su WhatsApp: ${whatsappUrl}\n\nIl Team TECHLAND`,
  };
}

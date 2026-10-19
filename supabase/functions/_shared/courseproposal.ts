/**
 * Proposta del corso successivo (drizzle/migrations/0036_course_proposals.sql).
 *
 * Testi e regole condivisi dalla edge function course-proposal: il messaggio
 * per la famiglia (email e push) e se lo sconto per chi continua subito vale
 * ancora.
 */
import { escapeHtml, type EmailContent } from "./emaillayout.ts";

/** Giorni di validità dell'offerta proposti all'admin quando invia. */
export const DEFAULT_OFFER_DAYS = 10;

/** 5000 → "50 €", 2550 → "25,50 €". */
export function formatEuro(cents: number): string {
  const euros = cents / 100;
  const text = Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} €`;
}

/** YYYY-MM-DD → "gg/mm/aaaa". */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Lo sconto vale se c'è e la famiglia risponde entro la scadenza (inclusa). */
export function discountStillValid(opts: { today: string; expiresOn: string | null; discountCents: number }): boolean {
  if (opts.discountCents <= 0 || !opts.expiresOn) return false;
  return opts.today <= opts.expiresOn;
}

export type ProposalMessage = {
  subject: string;
  pushTitle: string;
  pushBody: string;
  /** Paragrafi del corpo email (testo semplice, l'HTML lo costruisce la function). */
  paragraphs: string[];
  /** Citazione del motivo dell'insegnante. */
  quote: string;
  quoteAuthor: string;
};

/** Testo della proposta per la famiglia. */
export function proposalMessage(opts: {
  parentName: string | null;
  studentName: string;
  teacherName: string;
  fromCourse: string;
  proposedCourse: string;
  reason: string;
  discountCents: number;
  expiresOn: string;
}): ProposalMessage {
  const first = opts.studentName.split(" ")[0] || opts.studentName;
  const hello = opts.parentName ? `Ciao ${opts.parentName.split(" ")[0]},` : "Ciao,";
  const hasDiscount = opts.discountCents > 0;
  const until = formatDate(opts.expiresOn);
  const offer = hasDiscount
    ? `Se confermate entro il ${until}, avrete uno sconto di ${formatEuro(opts.discountCents)} sul nuovo corso e ${first} terrà il suo posto senza pause.`
    : `Se confermate entro il ${until}, ${first} terrà il suo posto senza pause.`;
  return {
    subject: hasDiscount
      ? `Il prossimo passo per ${first}: ${opts.proposedCourse} (sconto di ${formatEuro(opts.discountCents)})`
      : `Il prossimo passo per ${first}: ${opts.proposedCourse}`,
    pushTitle: `Il prossimo corso per ${first}`,
    pushBody: hasDiscount
      ? `${opts.teacherName} consiglia ${opts.proposedCourse}. Conferma entro il ${until}: ${formatEuro(opts.discountCents)} di sconto.`
      : `${opts.teacherName} consiglia ${opts.proposedCourse}. Conferma entro il ${until}.`,
    paragraphs: [
      hello,
      `${first} sta finendo il corso ${opts.fromCourse}. ${opts.teacherName}, che lo ha seguito lezione dopo lezione, consiglia come prossimo passo ${opts.proposedCourse}. Ecco perché:`,
      offer,
      "Puoi confermare o chiederci informazioni con un clic dall'area riservata.",
    ],
    quote: opts.reason.trim(),
    quoteAuthor: opts.teacherName,
  };
}

/** Email della proposta: citazione dell'insegnante, badge dello sconto e pulsante per rispondere. */
export function proposalEmail(msg: ProposalMessage, opts: { discountCents: number; expiresOn: string; siteUrl: string }): EmailContent {
  const [hello, intro, offer, cta] = msg.paragraphs.map(escapeHtml);
  const badge = opts.discountCents > 0
    ? `<tr><td style="padding:0 24px 8px;"><div style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:16px;text-align:center;">
       <div style="font-size:28px;font-weight:bold;color:#047857;">-${escapeHtml(formatEuro(opts.discountCents))}</div>
       <div style="font-size:14px;color:#065f46;">per chi conferma entro il ${escapeHtml(formatDate(opts.expiresOn))}</div></div></td></tr>`
    : "";
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(msg.pushTitle)}</h1></td></tr>
  <tr><td style="padding:28px 24px 8px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${hello}</p>
  <p style="margin:0 0 16px;">${intro}</p>
  <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:4px solid #10b981;background:#f9fafb;font-style:italic;">
  ${escapeHtml(msg.quote).replace(/\n/g, "<br>")}<br><span style="font-style:normal;color:#6b7280;font-size:14px;">— ${escapeHtml(msg.quoteAuthor)}</span></blockquote>
  </td></tr>
  ${badge}
  <tr><td style="padding:8px 24px 28px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${offer}</p>
  <p style="margin:0 0 20px;">${cta}</p>
  <p style="margin:0 0 20px;text-align:center;"><a href="${opts.siteUrl}/area-riservata" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Rispondi alla proposta →</a></p>
  <p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;
  const text = [...msg.paragraphs.slice(0, 2), `"${msg.quote}" — ${msg.quoteAuthor}`, ...msg.paragraphs.slice(2),
    `${opts.siteUrl}/area-riservata`, "Il Team TECHLAND"].join("\n\n");
  return { subject: msg.subject, html, text };
}

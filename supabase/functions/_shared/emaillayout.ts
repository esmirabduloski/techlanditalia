/**
 * Layout comune delle email alle famiglie: intestazione verde con il titolo,
 * card bianca, chiusura e piè di pagina "Il Team TECHLAND".
 * Prima era copiato a mano in ogni edge function.
 */

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Rende cliccabili gli URL di un testo già escapato. */
export const linkify = (escaped: string) =>
  escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#059669;font-weight:bold;">${url}</a>`);

/** Paragrafo da testo semplice: escapato, a capo mantenuti, URL cliccabili se richiesto. */
export function paragraph(text: string, opts: { linkify?: boolean } = {}): string {
  const safe = escapeHtml(text);
  return `<p style="margin:0 0 16px;">${(opts.linkify ? linkify(safe) : safe).replace(/\n/g, "<br>")}</p>`;
}

/** Pulsante verde centrato. `url` deve essere un indirizzo nostro o già validato. */
export function ctaButton(label: string, url: string): string {
  return `<p style="margin:8px 0 20px;text-align:center;"><a href="${url}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">${escapeHtml(label)}</a></p>`;
}

export const DEFAULT_CLOSING = `<p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>`;

export function brandedEmail(opts: {
  title: string;
  /** Emoji grande sopra il titolo (es. 🎓). */
  emoji?: string;
  /** HTML del corpo, già escapato. */
  bodyHtml: string;
  /** Chiusura sotto il corpo; di default "Per qualsiasi dubbio rispondi pure a questa email." */
  closingHtml?: string;
}): string {
  const heading = opts.emoji
    ? `<div style="font-size:40px;line-height:1;">${opts.emoji}</div>
  <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;">${escapeHtml(opts.title)}</h1>`
    : `<h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(opts.title)}</h1>`;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  ${heading}</td></tr>
  <tr><td style="padding:28px 24px;color:#1f2937;font-size:16px;line-height:1.6;">
  ${opts.bodyHtml}
  ${opts.closingHtml ?? DEFAULT_CLOSING}
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;
}

/** Email pronta per l'invio: oggetto, HTML e versione testo (facoltativa). */
export type EmailContent = { subject: string; html: string; text?: string };

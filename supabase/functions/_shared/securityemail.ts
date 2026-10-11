/**
 * Email di sicurezza dell'account (2FA) inviate con Resend, come le altre
 * email transazionali del progetto. Non bloccano mai il chiamante.
 */
import { Resend } from "https://esm.sh/resend@2.0.0";

const FROM = "TECHLAND <info@techlanditalia.it>";

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px;color:#111827">${title}</h1>
${body}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">Se non hai richiesto tu questa operazione, scrivi subito a info@techlanditalia.it.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendSecurityEmail(to: string, subject: string, title: string, bodyHtml: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn("[securityemail] RESEND_API_KEY mancante, email non inviata");
    return false;
  }
  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to: [to],
      subject,
      html: layout(title, bodyHtml),
    });
    if (error) {
      console.error("[securityemail] invio fallito:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[securityemail] invio fallito:", e);
    return false;
  }
}

export function codeBlock(code: string): string {
  return `<p style="margin:16px 0;text-align:center"><span style="display:inline-block;font-size:28px;letter-spacing:8px;font-weight:bold;background:#f3f4f6;border-radius:8px;padding:12px 20px">${code}</span></p>`;
}

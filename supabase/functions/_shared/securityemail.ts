/**
 * Email di sicurezza dell'account (2FA), inviate e registrate come le altre
 * email transazionali (_shared/email.ts; il corpo non si salva: contiene codici).
 * Non bloccano mai il chiamante. I testi stanno in emailtemplates.ts.
 */
import { sendEmail } from "./email.ts";
import type { EmailContent } from "./emaillayout.ts";

export async function sendSecurityEmail(
  kind: "security_mfa_code" | "security_mfa_reset",
  source: string,
  to: string,
  mail: EmailContent,
  recipientId?: string,
): Promise<boolean> {
  const result = await sendEmail({ kind, source, to, subject: mail.subject, html: mail.html, recipientId });
  return result.ok;
}

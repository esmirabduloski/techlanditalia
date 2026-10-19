/**
 * Testi delle email transazionali (prenotazione, contatti, benvenuto, password,
 * 2FA, newsletter, pulizia dati). Funzioni pure: le usano le edge function per
 * l'invio vero e il centro di controllo /admin/email per gli esempi.
 * Gli altri testi stanno vicino alla loro logica: certificates.ts,
 * courseproposal.ts, monthlyreport.ts, paymentreminders.ts,
 * satisfactionsurvey.ts, subscriptionpause.ts.
 */
import { escapeHtml, type EmailContent } from "./emaillayout.ts";

// ── Prenotazione lezione di prova ────────────────────────────────────────────

export type BookingData = {
  parentName: string;
  email: string;
  phone?: string;
  childAge: number;
  interest: string;
  availability?: string;
  message?: string;
};

const INTEREST_LABELS: Record<string, string> = {
  "coding-base": "Coding Base (6-8 anni)",
  "game-dev": "Game Development",
  "roblox": "Roblox Studio",
  "web": "Web Development",
  "python-ai": "Python & AI",
  "non-so": "Non sono sicuro, vorrei consigli",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  "mattina": "Mattina (9-12)",
  "pomeriggio": "Pomeriggio (14-18)",
  "sera": "Sera (18-20)",
  "weekend": "Weekend",
  "qualsiasi": "Qualsiasi orario",
};

/** Avviso allo staff e conferma al genitore. */
export function bookingEmails(data: BookingData): { staff: EmailContent; parent: EmailContent } {
  const safeParentName = escapeHtml(data.parentName || "");
  const safeEmail = escapeHtml(data.email || "");
  const safePhone = escapeHtml(data.phone || "");
  const safeMessage = data.message ? escapeHtml(data.message) : "";
  const childAge = escapeHtml(String(data.childAge ?? ""));
  const interestLabel = INTEREST_LABELS[data.interest] || escapeHtml(data.interest || "");
  const availabilityLabel = data.availability
    ? AVAILABILITY_LABELS[data.availability] || escapeHtml(data.availability)
    : "Non specificata";

  const staff: EmailContent = {
    subject: `🎯 Nuova prenotazione lezione di prova - ${data.parentName?.substring(0, 50) || "Nuovo"}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Nuova Prenotazione Lezione di Prova</h1>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Contatto</h2>
            <p><strong>Nome genitore:</strong> ${safeParentName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Telefono:</strong> ${safePhone || "Non fornito"}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Bambino</h2>
            <p><strong>Età:</strong> ${childAge} anni</p>
            <p><strong>Interesse:</strong> ${interestLabel}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Preferenze</h2>
            <p><strong>Disponibilità:</strong> ${availabilityLabel}</p>
            ${safeMessage ? `<p><strong>Messaggio:</strong> ${safeMessage}</p>` : ""}
          </div>
          <p style="color: #666; font-size: 14px;">Ricordati di contattare il genitore entro 24 ore!</p>
        </div>
      `,
  };

  const parent: EmailContent = {
    subject: "✅ Abbiamo ricevuto la tua richiesta - TECHLAND",
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Ciao ${safeParentName}!</h1>
          <p>Grazie per aver scelto <strong>TECHLAND</strong> per il tuo bambino.</p>
          <p>Abbiamo ricevuto la tua richiesta per una <strong>lezione di prova gratuita</strong> e ti contatteremo entro 24 ore per confermare l'appuntamento.</p>

          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Riepilogo della tua richiesta</h2>
            <p><strong>Età del bambino:</strong> ${childAge} anni</p>
            <p><strong>Area di interesse:</strong> ${interestLabel}</p>
            <p><strong>Disponibilità preferita:</strong> ${availabilityLabel}</p>
          </div>

          <h3>Cosa succede ora?</h3>
          <ol>
            <li>Un nostro consulente ti contatterà per fissare l'appuntamento</li>
            <li>Riceverai un link per la lezione di prova online</li>
            <li>Il tuo bambino potrà provare il corso scelto con un nostro docente</li>
          </ol>

          <p>Se hai domande nel frattempo, puoi rispondere a questa email.</p>

          <p style="margin-top: 30px;">A presto,<br><strong>Il team TECHLAND</strong></p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            TECHLAND - La scuola di tecnologia per bambini e ragazzi
          </p>
        </div>
      `,
  };

  return { staff, parent };
}

// ── Modulo contatti ──────────────────────────────────────────────────────────

export function contactStaffEmail(data: { nome: string; email: string; oggetto: string; messaggio: string }): EmailContent {
  const safeNome = escapeHtml(data.nome);
  return {
    subject: `[Contatto] ${data.oggetto.substring(0, 100)}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">Nuovo messaggio dal form contatti</h2>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nome:</strong> ${safeNome}</p>
            <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
            <p><strong>Oggetto:</strong> ${escapeHtml(data.oggetto)}</p>
          </div>
          <h3>Messaggio:</h3>
          <div style="background: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <p style="white-space: pre-wrap;">${escapeHtml(data.messaggio)}</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
          <p style="color: #71717a; font-size: 12px;">Puoi rispondere direttamente a questa email per contattare ${safeNome}.</p>
        </div>`,
    text: `Nuovo messaggio\n\nNome: ${data.nome}\nEmail: ${data.email}\nOggetto: ${data.oggetto}\n\nMessaggio:\n${data.messaggio}`,
  };
}

// ── Benvenuto e Trustpilot ───────────────────────────────────────────────────

/** Email di benvenuto al genitore. `setupLink` solo http(s), generato da Supabase. */
export function welcomeEmail(data: {
  fullName: string;
  email: string;
  childName: string;
  childUsername: string;
  setupLink: string;
}): EmailContent {
  const fullName = escapeHtml(data.fullName || "");
  const childName = escapeHtml(data.childName || "");
  const childUsername = escapeHtml(data.childUsername || "");
  const email = escapeHtml(data.email || "");
  // Il link è usato come href: niente escape, ma solo http(s)
  const setupLink = /^https?:\/\//i.test(data.setupLink || "") ? data.setupLink : "";
  return {
    subject: "Benvenuto in TECHLAND - Account creato con successo",
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;">
    <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:40px 30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Benvenuto in TECHLAND</h1></td></tr>
      <tr><td style="padding:40px 30px;">
        <h2 style="color:#1f2937;margin:0 0 20px;font-size:22px;">Gentile ${fullName},</h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px;">La ringraziamo per aver scelto TECHLAND per l'educazione tecnologica di ${childName}.</p>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px;">Il suo account e quello di ${childName} sono stati creati con successo.</p>
        <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border-radius:12px;padding:24px;margin:30px 0;border:2px solid #3b82f6;">
          <h3 style="color:#1d4ed8;margin:0 0 15px;font-size:18px;">🔑 Le sue credenziali di accesso (genitore):</h3>
          <p style="color:#1f2937;font-size:16px;font-weight:bold;margin:8px 0;"><strong>Email:</strong> ${email}</p>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:8px 0 16px;">Per motivi di sicurezza la password non viene inviata via email. Usi il pulsante qui sotto per impostare la sua password personale (link valido una sola volta).</p>
          ${setupLink ? `<div style="text-align:center;margin:8px 0 0;"><a href="${setupLink}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:15px;">Imposta la tua password →</a></div>` : `<p style="color:#1f2937;font-size:14px;margin:8px 0;">Acceda a <a href="https://techlanditalia.it/area-riservata">techlanditalia.it/area-riservata</a> e usi "Password dimenticata" per impostare la sua password.</p>`}
        </div>
        <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfeff 100%);border-radius:12px;padding:24px;margin:30px 0;border:2px solid #10b981;">
          <h3 style="color:#059669;margin:0 0 15px;font-size:18px;">🔐 Accesso di ${childName}:</h3>
          <p style="color:#1f2937;font-size:16px;font-weight:bold;margin:8px 0;"><strong>Nome utente:</strong> ${childUsername}</p>
          <p style="color:#4b5563;font-size:15px;margin:8px 0;">Dopo aver impostato la sua password, entri nell'area riservata e nella sezione «I Tuoi Figli» scelga la password di ${childName} con il pulsante «Nuova password»: ${childName} entrerà con il nome utente qui sopra e quella password.</p>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://techlanditalia.it/area-riservata" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">Accedi all'Area Riservata →</a>
        </div>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0;">Cordiali saluti,</p>
      </td></tr>
      <tr><td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280;font-size:14px;margin:0 0 10px;font-weight:600;">Il Team TECHLAND</p>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Corsi di coding per bambini e ragazzi | techlanditalia.it</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>
`,
  };
}

/** Indirizzo del servizio inviti automatici (AFS) di Trustpilot per techlanditalia.it. */
export const TRUSTPILOT_AFS_ADDRESS = "techlanditalia.it+af31baed12@invite.trustpilot.com";

/**
 * Trustpilot legge i dati dell'invito dallo snippet JSON: riceve solo nome ed
 * email del genitore (più un riferimento), nient'altro.
 */
export function trustpilotInviteEmail(data: { email: string; fullName: string; referenceId: string }): EmailContent {
  const snippet = JSON.stringify({
    recipientEmail: data.email.trim().toLowerCase(),
    recipientName: data.fullName.trim(),
    referenceId: data.referenceId,
  }).replace(/</g, "\\u003c"); // "<" escapato: lo snippet resta JSON valido e non può chiudere il tag script
  return {
    subject: "Invito recensione",
    html: `<script type="application/json+trustpilot">${snippet}</script>`,
  };
}

// ── Password e verifica in due passaggi ──────────────────────────────────────

export function passwordResetEmail(resetLink: string): EmailContent {
  return {
    subject: "🔐 Reimposta la tua password - TECHLAND",
    html: `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔐 Reset Password</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">TECHLAND</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 22px;">Ciao! 👋</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Abbiamo ricevuto una richiesta per reimpostare la password del tuo account TECHLAND.
              </p>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Clicca il pulsante qui sotto per creare una nuova password:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  🔑 Reimposta Password
                </a>
              </div>

              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                  ⚠️ <strong>Attenzione:</strong> Se non hai richiesto tu il reset della password, puoi ignorare questa email. Il tuo account rimarrà sicuro.
                </p>
              </div>

              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 15px;">
                Il link scadrà tra 1 ora per motivi di sicurezza.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Se il pulsante non funziona, copia e incolla questo link nel browser:
              </p>
              <p style="word-break: break-all; margin: 10px 0 0 0;">
                <a href="${resetLink}" style="color: #10b981; font-size: 12px;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px;">
                Il Team TECHLAND 💚
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Corsi di coding per giovani esploratori digitali
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `,
  };
}

function securityLayout(title: string, body: string): string {
  return `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px;color:#111827">${title}</h1>
${body}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">Se non hai richiesto tu questa operazione, scrivi subito a info@techlanditalia.it.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function codeBlock(code: string): string {
  return `<p style="margin:16px 0;text-align:center"><span style="display:inline-block;font-size:28px;letter-spacing:8px;font-weight:bold;background:#f3f4f6;border-radius:8px;padding:12px 20px">${escapeHtml(code)}</span></p>`;
}

/** Codice monouso per recuperare la 2FA (mfa-recovery). */
export function mfaCodeEmail(code: string): EmailContent {
  return {
    subject: "Codice per recuperare l'accesso - TECHLAND",
    html: securityLayout(
      "Recupero della verifica in due passaggi",
      `<p>Hai chiesto di recuperare l'accesso perché non puoi più usare la tua app di autenticazione.</p>
         <p>Inserisci questo codice nella pagina di TECHLAND:</p>${codeBlock(code)}
         <p style="font-size:13px;color:#6b7280">Il codice scade a breve. Dopo la conferma un amministratore verificherà la richiesta prima di reimpostare la 2FA.</p>`,
    ),
  };
}

/** Avviso di 2FA reimpostata da un admin (admin-reset-mfa). */
export function mfaResetEmail(): EmailContent {
  return {
    subject: "La verifica in due passaggi è stata reimpostata - TECHLAND",
    html: securityLayout(
      "Verifica in due passaggi reimpostata",
      `<p>Un amministratore di TECHLAND ha reimpostato la verifica in due passaggi del tuo account, come da tua richiesta.</p>
         <p>Tutte le sessioni aperte sono state chiuse. Al prossimo accesso con email e password ti verrà chiesto di configurare di nuovo un'app di autenticazione.</p>`,
    ),
  };
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export function newsletterConfirmEmail(data: { confirmUrl: string; siteUrl: string; year: number }): EmailContent {
  return {
    subject: "Conferma la tua iscrizione alla newsletter TECHLAND",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #10b981; margin: 0;">🚀 TECHLAND</h1><p style="color: #666; margin-top: 5px;">Coding per Ragazzi</p></div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Conferma la tua iscrizione</h2>
            <p>Ciao! 👋</p>
            <p>Grazie per aver richiesto di iscriverti alla newsletter di TECHLAND. Per completare l'iscrizione, clicca sul pulsante qui sotto:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.confirmUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">✅ Conferma Iscrizione</a>
            </div>
            <p style="color: #666; font-size: 14px;">Se non hai richiesto questa iscrizione, puoi ignorare questa email.</p>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>© ${data.year} TECHLAND - Tutti i diritti riservati</p>
            <p><a href="${data.siteUrl}" style="color: #10b981;">techlanditalia.it</a></p>
          </div>
        </body></html>`,
  };
}

/** `contentHtml` arriva dall'editor dell'admin (Admin → Newsletter) ed è già HTML. */
export function newsletterEmail(data: {
  subject: string;
  contentHtml: string;
  siteUrl: string;
  unsubscribeUrl: string;
  year: number;
}): EmailContent {
  return {
    subject: data.subject.trim(),
    html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #10b981; margin: 0;">🚀 TECHLAND</h1>
                  <p style="color: #666; margin-top: 5px;">Coding per Bambini</p>
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                  ${data.contentHtml}
                </div>

                <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                  <p>© ${data.year} TECHLAND - Tutti i diritti riservati</p>
                  <p>
                    <a href="${data.siteUrl}" style="color: #10b981;">techlanditalia.it</a>
                  </p>
                  <p style="margin-top: 20px;">
                    <a href="${data.unsubscribeUrl}" style="color: #999; text-decoration: underline;">Disiscriviti dalla newsletter</a>
                  </p>
                </div>
              </body>
              </html>
            `,
  };
}

// ── Pulizia dati (Privacy Policy) ────────────────────────────────────────────

/** Destinatari dell'avviso di pulizia dati se manca RETENTION_NOTIFY_EMAILS. */
export const DEFAULT_RETENTION_NOTIFY_EMAILS = "info@techlanditalia.it,infotechlanditalia@gmail.com";

/** "a@x.it, b@x.it" → ["a@x.it", "b@x.it"] */
export function emailList(value: string): string[] {
  return value.split(",").map((e) => e.trim()).filter(Boolean);
}

export type RetentionSummaryRow = { label: string; cutoff: string; count: number };

export function dataRetentionEmail(data: { summary: RetentionSummaryRow[]; total: number; link: string }): EmailContent {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("it-IT");
  const rowsHtml = data.summary.map((r) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(r.label)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right"><strong>${r.count}</strong></td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">prima del ${fmt(r.cutoff)}</td></tr>`).join("");
  return {
    subject: `[TECHLAND] Pulizia dati da approvare: ${data.total} record oltre i termini`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="color:#1d724a">Pulizia dati: ${data.total} record oltre i termini di conservazione</h2>
      <p>La scansione mensile ha trovato dati che hanno superato i termini dichiarati nella Privacy Policy.
      <strong>Non è stato cancellato nulla</strong>: la cancellazione parte solo dopo la tua approvazione.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:6px 10px">Categoria</th><th style="padding:6px 10px">Record</th><th style="text-align:left;padding:6px 10px">Soglia</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin:24px 0"><a href="${data.link}" style="background:#1d724a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Rivedi e approva</a></p>
      <p style="font-size:12px;color:#6b7280">Puoi scegliere quali categorie cancellare o rifiutare la run. Finché non approvi, i dati restano dove sono. Riceverai un nuovo promemoria alla prossima scansione mensile.</p>
    </div>`,
  };
}

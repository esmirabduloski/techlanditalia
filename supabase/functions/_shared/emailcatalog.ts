/**
 * Esempi delle email per il centro di controllo /admin/email: ogni tipo di
 * emailkinds.ts con dati finti (famiglia Rossi), composto con gli stessi
 * builder dell'invio vero, così l'anteprima non può divergere.
 */
import type { EmailContent } from "./emaillayout.ts";
import { EMAIL_KINDS, EMAIL_KIND_KEYS, type EmailKind, type EmailKindInfo } from "./emailkinds.ts";
import { certificateEmail, certificateMessage } from "./certificates.ts";
import { proposalEmail, proposalMessage } from "./courseproposal.ts";
import { buildReportEmail, type MonthlyStats } from "./monthlyreport.ts";
import { paymentEmail, type PaymentForText } from "./paymentreminders.ts";
import { surveyEmail, surveyInviteMessage, thankYouMessage, TRUSTPILOT_REVIEW_URL } from "./satisfactionsurvey.ts";
import { pauseEndingEmail, pauseEndingMessage } from "./subscriptionpause.ts";
import { closureNoticeEmail, closureNoticeMessage } from "./closurenotice.ts";
import {
  bookingEmails,
  contactStaffEmail,
  dataRetentionEmail,
  mfaCodeEmail,
  mfaResetEmail,
  newsletterConfirmEmail,
  newsletterEmail,
  passwordResetEmail,
  trustpilotInviteEmail,
  welcomeEmail,
} from "./emailtemplates.ts";

const PARENT = "Anna Rossi";
const PARENT_EMAIL = "anna.rossi@example.com";
const STUDENT = "Luca Rossi";
const TEACHER = "Marco Bianchi";

const samplePayment: PaymentForText = {
  amount_cents: 8900,
  description: "Corso Python Base",
  due_date: "2026-11-05",
  installment_number: 3,
  installment_total: 10,
  crm_leads: { full_name: PARENT, linked_profile_id: "00000000-0000-0000-0000-000000000000" },
};

function sampleStats(scale: number): MonthlyStats {
  const n = (v: number) => Math.round(v * scale);
  return {
    from: "2026-09-01",
    to: "2026-09-30",
    enrollments: { families_won: n(6), new_students: n(8) },
    cancellations: {
      total: n(2),
      whole_family: n(1),
      by_reason: [{ reason: "cost", count: n(1) }, { reason: "schedule", count: n(1) }],
      would_return: { yes: n(1), maybe: n(1), no: 0 },
    },
    revenue: { paid_cents: n(420000), paid_count: n(48), unpaid_cents: n(35600), unpaid_count: n(4) },
    trials: { requested: n(14), completed: n(11), cancelled: n(2), converted: n(6) },
    conversion: { won: n(6), lost: n(3) },
    satisfaction: {
      surveys: { sent: n(20), answered: n(15), promoters: n(11), detractors: n(1), avg_score: 8.9 },
      attendance_marked: n(320),
      attendance_present: n(296),
      attendance_justified: n(12),
      at_risk_flagged: n(2),
    },
    active_students: n(64),
  };
}

const SAMPLES: Record<EmailKind, (siteUrl: string) => EmailContent> = {
  booking_confirmation: () =>
    bookingEmails({ parentName: PARENT, email: PARENT_EMAIL, phone: "333 1234567", childAge: 9, interest: "roblox", availability: "pomeriggio" }).parent,
  staff_booking: () =>
    bookingEmails({
      parentName: PARENT,
      email: PARENT_EMAIL,
      phone: "333 1234567",
      childAge: 9,
      interest: "roblox",
      availability: "pomeriggio",
      message: "Luca adora Minecraft, vorremmo provare.",
    }).staff,
  welcome: (siteUrl) =>
    welcomeEmail({
      fullName: PARENT,
      email: PARENT_EMAIL,
      childName: STUDENT,
      childUsername: "luca.rossi",
      setupLink: `${siteUrl}/auth?esempio=imposta-password`,
    }),
  trustpilot_invite: () => trustpilotInviteEmail({ email: PARENT_EMAIL, fullName: PARENT, referenceId: "account-esempio" }),
  payment_reminder: (siteUrl) =>
    paymentEmail(samplePayment, "reminder", { siteUrl, instructions: "Bonifico su IBAN IT00 X000 0000 0000 0000 0000 000" }),
  payment_overdue: (siteUrl) =>
    paymentEmail(samplePayment, "overdue", { siteUrl, instructions: "Bonifico su IBAN IT00 X000 0000 0000 0000 0000 000" }),
  pause_ending: (siteUrl) => pauseEndingEmail(pauseEndingMessage({ studentName: STUDENT, endsOn: "2026-11-09", days: 7 }), siteUrl),
  closure_notice: (siteUrl) =>
    closureNoticeEmail(
      closureNoticeMessage({
        closure: {
          title: "Vacanze di Natale",
          start_date: "2026-12-23",
          end_date: "2027-01-06",
          note: "Le lezioni riprendono giovedì 7 gennaio",
        },
        studentNames: [STUDENT, "Giulia Rossi"],
        today: "2026-12-20",
      }),
      { parentName: PARENT, siteUrl },
    ),
  survey_invite: (siteUrl) => {
    const { title, body } = surveyInviteMessage({ studentName: STUDENT, kind: "module_end", moduleTitle: "Primi giochi con Scratch" });
    const url = `${siteUrl}/area-riservata?sondaggio=esempio`;
    return surveyEmail({
      subject: title,
      paragraphs: [body],
      text: `${body}\n\nRispondi qui: ${url}\n\nIl Team TECHLAND`,
      cta: { label: "Rispondi al sondaggio", url },
    });
  },
  survey_thanks: (siteUrl) => {
    const msg = thankYouMessage({
      studentName: STUDENT,
      trustpilotUrl: TRUSTPILOT_REVIEW_URL,
      referralLink: `${siteUrl}/?ref=REFESEMPIO`,
      rewardText: "Per ogni famiglia che si iscrive, un mese gratis per voi.",
    });
    return surveyEmail({ ...msg, cta: { label: "Lascia una recensione su Trustpilot", url: TRUSTPILOT_REVIEW_URL } });
  },
  course_proposal: (siteUrl) =>
    proposalEmail(
      proposalMessage({
        parentName: PARENT,
        studentName: STUDENT,
        teacherName: TEACHER,
        fromCourse: "Scratch Junior",
        proposedCourse: "Python Base",
        reason: "Luca risolve i problemi da solo e ha voglia di scrivere codice vero: Python è il passo giusto.",
        discountCents: 5000,
        expiresOn: "2026-11-15",
      }),
      { discountCents: 5000, expiresOn: "2026-11-15", siteUrl },
    ),
  certificate_released: (siteUrl) =>
    certificateEmail(
      certificateMessage({ parentName: PARENT, studentName: STUDENT, courseTitle: "Python Base", teacherName: TEACHER }),
      siteUrl,
    ),
  password_reset: (siteUrl) => passwordResetEmail(`${siteUrl}/auth?reset=true&esempio=link-monouso`),
  security_mfa_code: () => mfaCodeEmail("123456"),
  security_mfa_reset: () => mfaResetEmail(),
  newsletter_confirm: (siteUrl) =>
    newsletterConfirmEmail({ confirmUrl: `${siteUrl}/newsletter?esempio=conferma`, siteUrl, year: new Date().getFullYear() }),
  newsletter: (siteUrl) =>
    newsletterEmail({
      subject: "Novità di novembre da TECHLAND",
      contentHtml: "<h2>Ciao!</h2><p>Questo è un esempio: il contenuto vero lo scrive l'admin in Admin → Newsletter.</p>",
      siteUrl,
      unsubscribeUrl: `${siteUrl}/newsletter?azione=disiscrizione&token=esempio`,
      year: new Date().getFullYear(),
    }),
  staff_contact: () =>
    contactStaffEmail({
      nome: PARENT,
      email: PARENT_EMAIL,
      oggetto: "Informazioni sui corsi",
      messaggio: "Buongiorno, mio figlio ha 10 anni: quale corso ci consigliate?\nGrazie!",
    }),
  staff_monthly_report: (siteUrl) => buildReportEmail({ month: "2026-09", cur: sampleStats(1), prev: sampleStats(0.8), siteUrl }),
  staff_data_retention: (siteUrl) =>
    dataRetentionEmail({
      summary: [
        { label: "Richieste di lezione di prova", cutoff: "2024-10-01", count: 12 },
        { label: "Messaggi dal form contatti", cutoff: "2024-10-01", count: 5 },
      ],
      total: 17,
      link: `${siteUrl}/admin/privacy?run=esempio`,
    }),
};

export type CatalogEntry = EmailKindInfo & { kind: EmailKind; sample: EmailContent };

export function emailSample(kind: EmailKind, siteUrl: string): EmailContent {
  return SAMPLES[kind](siteUrl.replace(/\/$/, ""));
}

export function emailCatalog(siteUrl: string): CatalogEntry[] {
  return EMAIL_KIND_KEYS.map((kind) => ({ kind, ...EMAIL_KINDS[kind], sample: emailSample(kind, siteUrl) }));
}

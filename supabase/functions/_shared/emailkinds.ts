/**
 * Tipi di email inviate dalle edge function (centro di controllo in /admin/email).
 *
 * La chiave finisce in public.email_log.kind (drizzle/migrations/0057_email_log.sql).
 * `storeBody: false` per le email con link o codici d'accesso (o identiche per
 * tutti, come la newsletter): nel registro resta solo oggetto e destinatario.
 * Gli esempi con dati finti stanno in emailcatalog.ts, che serve solo alla
 * pagina admin: qui restano i metadati, letti da ogni invio (email.ts).
 */

export type EmailAudience = "famiglia" | "staff" | "iscritti" | "esterno";
export type EmailCategory = "automatica" | "evento" | "manuale";

export type EmailKindInfo = {
  label: string;
  audience: EmailAudience;
  category: EmailCategory;
  /** Quando parte, in italiano per l'admin. */
  trigger: string;
  /** Orario del job pianificato (ora di Roma), se è automatica. */
  schedule: string | null;
  /** Edge function che la invia. */
  source: string;
  storeBody: boolean;
};

export const EMAIL_KINDS = {
  booking_confirmation: {
    label: "Conferma prenotazione lezione di prova",
    audience: "famiglia",
    category: "evento",
    trigger: "Subito dopo la prenotazione di una lezione di prova dal sito.",
    schedule: null,
    source: "send-booking-notification",
    storeBody: true,
  },
  welcome: {
    label: "Benvenuto (account creato)",
    audience: "famiglia",
    category: "evento",
    trigger: "Quando un admin crea l'account del genitore e del figlio. Contiene il link per impostare la password.",
    schedule: null,
    source: "send-welcome-email",
    storeBody: false,
  },
  trustpilot_invite: {
    label: "Invito recensione Trustpilot",
    audience: "esterno",
    category: "evento",
    trigger: "Insieme al benvenuto di un genitore: Trustpilot riceve nome ed email e manda lui l'invito.",
    schedule: null,
    source: "send-welcome-email",
    storeBody: true,
  },
  payment_reminder: {
    label: "Promemoria pagamento",
    audience: "famiglia",
    category: "automatica",
    trigger: "Nel giorno del promemoria della rata (CRM → pagamenti), solo se il cliente non ha le notifiche push attive. Anche a mano dall'admin.",
    schedule: "ogni giorno alle 9:00 (8:00 con l'ora solare)",
    source: "send-payment-reminders",
    storeBody: true,
  },
  payment_overdue: {
    label: "Sollecito rata scaduta",
    audience: "famiglia",
    category: "automatica",
    trigger: "Rata non pagata dopo la scadenza, secondo le regole dei solleciti (dopo quanti giorni, ogni quanti, quante volte), se l'avviso al cliente è attivo e il cliente non ha le notifiche push.",
    schedule: "ogni giorno alle 9:00 (8:00 con l'ora solare)",
    source: "send-payment-reminders",
    storeBody: true,
  },
  pause_ending: {
    label: "Fine pausa in arrivo",
    audience: "famiglia",
    category: "automatica",
    trigger: "14 e 7 giorni prima della ripresa delle lezioni dopo una pausa dell'abbonamento (email e push).",
    schedule: "ogni giorno alle 9:00 (8:00 con l'ora solare)",
    source: "subscription-pause-check",
    storeBody: true,
  },
  survey_invite: {
    label: "Sondaggio di soddisfazione",
    audience: "famiglia",
    category: "automatica",
    trigger: "Il giorno dopo la terza lezione e dopo l'ultima lezione di ogni modulo, salvo un sondaggio negli ultimi giorni o lo studente in pausa (email e push).",
    schedule: "ogni giorno alle 18:00 (17:00 con l'ora solare)",
    source: "satisfaction-survey",
    storeBody: true,
  },
  survey_thanks: {
    label: "Grazie per il sondaggio",
    audience: "famiglia",
    category: "evento",
    trigger: "Dopo una risposta con voto alto: invito a recensire su Trustpilot e link referral.",
    schedule: null,
    source: "satisfaction-survey",
    storeBody: true,
  },
  course_proposal: {
    label: "Proposta del prossimo corso",
    audience: "famiglia",
    category: "manuale",
    trigger: "Quando un admin invia la proposta preparata dall'insegnante (email e push).",
    schedule: null,
    source: "course-proposal",
    storeBody: true,
  },
  certificate_released: {
    label: "Attestato di fine corso pronto",
    audience: "famiglia",
    category: "evento",
    trigger: "Quando l'insegnante sblocca gli attestati del gruppo (email e push).",
    schedule: null,
    source: "certificates-released",
    storeBody: true,
  },
  password_reset: {
    label: "Reimposta password",
    audience: "famiglia",
    category: "evento",
    trigger: "Quando qualcuno usa \"Password dimenticata\" nella pagina di accesso.",
    schedule: null,
    source: "send-password-reset-email",
    storeBody: false,
  },
  security_mfa_code: {
    label: "Codice recupero verifica in due passaggi",
    audience: "famiglia",
    category: "evento",
    trigger: "Quando un utente chiede di recuperare l'accesso perché ha perso l'app di autenticazione.",
    schedule: null,
    source: "mfa-recovery",
    storeBody: false,
  },
  security_mfa_reset: {
    label: "Verifica in due passaggi reimpostata",
    audience: "famiglia",
    category: "manuale",
    trigger: "Quando un admin reimposta la verifica in due passaggi di un utente.",
    schedule: null,
    source: "admin-reset-mfa",
    storeBody: false,
  },
  newsletter_confirm: {
    label: "Conferma iscrizione newsletter",
    audience: "iscritti",
    category: "evento",
    trigger: "Quando qualcuno si iscrive alla newsletter dal sito.",
    schedule: null,
    source: "newsletter-subscribe",
    storeBody: false,
  },
  newsletter: {
    label: "Newsletter",
    audience: "iscritti",
    category: "manuale",
    trigger: "Quando un admin invia una newsletter a tutti gli iscritti confermati (Admin → Newsletter).",
    schedule: null,
    source: "newsletter-send",
    storeBody: false,
  },
  staff_booking: {
    label: "Nuova prenotazione (staff)",
    audience: "staff",
    category: "evento",
    trigger: "Subito dopo la prenotazione di una lezione di prova dal sito.",
    schedule: null,
    source: "send-booking-notification",
    storeBody: true,
  },
  staff_contact: {
    label: "Nuovo messaggio dal modulo contatti (staff)",
    audience: "staff",
    category: "evento",
    trigger: "Quando qualcuno scrive dal modulo contatti del sito.",
    schedule: null,
    source: "send-contact-email",
    storeBody: true,
  },
  staff_monthly_report: {
    label: "Report mensile (admin)",
    audience: "staff",
    category: "automatica",
    trigger: "Il primo del mese, con i numeri del mese appena chiuso, a tutti gli admin. Anche a mano da CRM → Analytics.",
    schedule: "il 1° del mese alle 8:00 (7:00 con l'ora solare)",
    source: "monthly-report",
    storeBody: true,
  },
  staff_data_retention: {
    label: "Pulizia dati da approvare (staff)",
    audience: "staff",
    category: "automatica",
    trigger: "Il primo del mese, solo se ci sono dati oltre i termini di conservazione della Privacy Policy.",
    schedule: "il 1° del mese alle 8:00 (7:00 con l'ora solare)",
    source: "data-retention",
    storeBody: true,
  },
} satisfies Record<string, EmailKindInfo>;

export type EmailKind = keyof typeof EMAIL_KINDS;

export const EMAIL_KIND_KEYS = Object.keys(EMAIL_KINDS) as EmailKind[];

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EMAIL_KINDS, value);
}

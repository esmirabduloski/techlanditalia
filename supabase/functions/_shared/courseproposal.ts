/**
 * Proposta del corso successivo (drizzle/migrations/0036_course_proposals.sql).
 *
 * Testi e regole condivisi dalla edge function course-proposal: il messaggio
 * per la famiglia (email e push) e se lo sconto per chi continua subito vale
 * ancora.
 */

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

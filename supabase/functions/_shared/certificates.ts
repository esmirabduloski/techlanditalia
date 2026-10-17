/**
 * Attestati di fine corso (drizzle/migrations/0049_course_certificates.sql).
 *
 * Testi dell'avviso alla famiglia (email e push) usati dalla edge function
 * certificates-released quando l'insegnante sblocca gli attestati.
 */

export type CertificateMessage = {
  subject: string;
  pushTitle: string;
  pushBody: string;
  /** Paragrafi del corpo email (testo semplice, l'HTML lo costruisce la function). */
  paragraphs: string[];
};

/** 45 → "45", 1.5 → "1,5". */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Avviso per il genitore (o per l'alunno senza genitore collegato). */
export function certificateMessage(opts: {
  parentName: string | null;
  studentName: string;
  courseTitle: string;
  teacherName: string;
  lessonsAttended: number;
  hoursAttended: number;
}): CertificateMessage {
  const first = firstName(opts.studentName);
  const hello = opts.parentName ? `Ciao ${firstName(opts.parentName)},` : "Ciao,";
  const lessons = opts.lessonsAttended === 1 ? "1 lezione" : `${opts.lessonsAttended} lezioni`;
  return {
    subject: `🎓 L'attestato di ${first} è pronto`,
    pushTitle: `🎓 L'attestato di ${first} è pronto`,
    pushBody: `${first} ha completato ${opts.courseTitle}: scarica l'attestato dall'area riservata.`,
    paragraphs: [
      hello,
      `${first} ha completato il corso ${opts.courseTitle}! ${lessons} e ${formatHours(opts.hoursAttended)} ore di coding, ` +
        `insieme a ${opts.teacherName}: oggi è il giorno della festa.`,
      `Nell'area riservata, alla sezione Certificazioni, trovate il suo attestato con le competenze imparate: ` +
        `potete scaricarlo in PDF, stamparlo o condividerlo con chi volete.`,
      "Complimenti da tutto il team TECHLAND!",
    ],
  };
}

/** Avviso per l'alunno che ha un genitore collegato (solo push). */
export function studentPush(opts: { studentName: string; courseTitle: string }): { title: string; body: string } {
  return {
    title: "🎓 Il tuo attestato è pronto!",
    body: `Hai completato ${opts.courseTitle}, ${firstName(opts.studentName)}: lo trovi nella tua area riservata.`,
  };
}

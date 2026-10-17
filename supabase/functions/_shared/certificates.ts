/**
 * Attestati di fine corso (drizzle/migrations/0050_course_certificates.sql).
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

/** Lezioni e ore stampate sull'attestato: uguali per tutti (come in src/lib/certificate.ts). */
export const CERTIFICATE_LESSONS = 32;
export const CERTIFICATE_HOURS = 320;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Avviso per il genitore (o per l'alunno senza genitore collegato). */
export function certificateMessage(opts: {
  parentName: string | null;
  studentName: string;
  courseTitle: string;
  teacherName: string;
}): CertificateMessage {
  const first = firstName(opts.studentName);
  const hello = opts.parentName ? `Ciao ${firstName(opts.parentName)},` : "Ciao,";
  return {
    subject: `🎓 L'attestato di ${first} è pronto`,
    pushTitle: `🎓 L'attestato di ${first} è pronto`,
    pushBody: `${first} ha completato ${opts.courseTitle}: scarica l'attestato dall'area riservata.`,
    paragraphs: [
      hello,
      `${first} ha completato il corso ${opts.courseTitle}! ${CERTIFICATE_LESSONS} lezioni e ${CERTIFICATE_HOURS} ore di coding, ` +
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

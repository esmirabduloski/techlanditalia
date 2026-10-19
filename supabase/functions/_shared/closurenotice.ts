/**
 * Avviso alle famiglie prima di una chiusura o festività (tabella
 * school_closures, drizzle/migrations/0060_school_closures.sql).
 *
 * Il job school-closure-notice gira ogni mattina: per le chiusure che iniziano
 * entro NOTICE_DAYS_BEFORE giorni e non ancora annunciate avvisa con push ed
 * email le famiglie che in quei giorni avrebbero lezione
 * (public.school_closure_audience). Funzioni pure, testate con vitest.
 */
import { brandedEmail, ctaButton, paragraph, type EmailContent } from "./emaillayout.ts";
import { daysBetween } from "./subscriptionpause.ts";

/** Quanti giorni prima dell'inizio parte l'avviso. */
export const NOTICE_DAYS_BEFORE = 3;
/** Dove porta il click su push ed email: la scheda delle chiusure nell'area genitore. */
export const CLOSURES_PATH = "/area-riservata#chiusure";

export type ClosureForNotice = {
  title: string;
  start_date: string;
  end_date: string;
  note: string | null;
};

/**
 * Se oggi va mandato l'avviso: non ancora mandato e chiusura che inizia tra
 * 0 e NOTICE_DAYS_BEFORE giorni. Se il job salta qualche giorno recupera,
 * anche il giorno stesso; a chiusura iniziata non avvisa più.
 */
export function noticeDue(opts: { today: string; startDate: string; notifiedAt: string | null }): boolean {
  if (opts.notifiedAt) return false;
  const days = daysBetween(opts.today, opts.startDate);
  return days >= 0 && days <= NOTICE_DAYS_BEFORE;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function italianDate(iso: string, withWeekday: boolean): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    ...(withWeekday ? { weekday: "long" } : {}),
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** "martedì 8 dicembre" oppure "da mercoledì 23 dicembre a mercoledì 6 gennaio". */
export function closurePeriod(startDate: string, endDate: string): string {
  if (startDate === endDate) return italianDate(startDate, true);
  return `da ${italianDate(startDate, true)} a ${italianDate(endDate, true)}`;
}

/** "Luca", "Luca e Giulia", "Luca, Giulia e Marco" (nomi propri). */
export function namesList(names: string[]): string {
  const first = names.map(firstName);
  if (first.length <= 1) return first[0] ?? "";
  return `${first.slice(0, -1).join(", ")} e ${first[first.length - 1]}`;
}

/** Titolo e testo dell'avviso (push ed email). */
export function closureNoticeMessage(opts: {
  closure: ClosureForNotice;
  studentNames: string[];
  today: string;
}): { title: string; body: string } {
  const { closure, studentNames, today } = opts;
  const single = closure.start_date === closure.end_date;
  const days = daysBetween(today, closure.start_date);

  let title: string;
  if (!single) {
    title = `📅 Niente lezioni dal ${italianDate(closure.start_date, false)} al ${italianDate(closure.end_date, false)}`;
  } else if (days === 0) {
    title = "📅 Oggi niente lezioni";
  } else if (days === 1) {
    title = `📅 Domani, ${italianDate(closure.start_date, true)}, niente lezioni`;
  } else {
    title = `📅 ${capitalize(italianDate(closure.start_date, true))} niente lezioni`;
  }

  const names = namesList(studentNames);
  const who = names
    ? `${single ? "quel giorno" : "in quei giorni"} ${names} non ${studentNames.length > 1 ? "hanno" : "ha"} lezione`
    : `${single ? "quel giorno" : "in quei giorni"} non ci sono lezioni`;
  const note = closure.note?.trim();
  const body = `${closure.title.trim()}: TECHLAND è chiusa ${closurePeriod(closure.start_date, closure.end_date)}, quindi ${who}.` +
    (note ? ` ${/[.!?]$/.test(note) ? note : `${note}.`}` : "");
  return { title, body };
}

/** Email dell'avviso, con il link al calendario delle chiusure nell'area riservata. */
export function closureNoticeEmail(
  msg: { title: string; body: string },
  opts: { parentName: string | null; siteUrl: string },
): EmailContent {
  const hello = opts.parentName ? `Ciao ${firstName(opts.parentName)},` : "Ciao,";
  const outro = "Tutte le chiusure e le festività dell'anno sono nell'area riservata.";
  const url = `${opts.siteUrl}${CLOSURES_PATH}`;
  return {
    subject: msg.title,
    html: brandedEmail({
      title: msg.title.replace(/^📅\s*/, ""),
      emoji: "📅",
      bodyHtml: [paragraph(hello), paragraph(msg.body), paragraph(outro), ctaButton("Vedi il calendario delle chiusure", url)].join("\n  "),
    }),
    text: [hello, msg.body, outro, url, "Il Team TECHLAND"].join("\n\n"),
  };
}

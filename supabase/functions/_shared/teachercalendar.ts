/**
 * Calendario delle lezioni dell'insegnante in formato iCalendar (RFC 5545),
 * servito dall'edge function teacher-calendar-feed: l'insegnante ci si iscrive
 * da Google Calendar (o Apple Calendar, Outlook) e le lezioni si aggiornano
 * da sole.
 *
 * Data e ora delle lezioni sono di Roma: gli eventi usano TZID=Europe/Rome con
 * il suo VTIMEZONE, così l'ora resta giusta al cambio dell'ora legale e per chi
 * guarda il calendario da un altro fuso. Le lezioni senza orario (né della
 * lezione né del gruppo) diventano eventi di tutto il giorno.
 *
 * Nel calendario ci sono solo gruppo, corso, numero e titolo della lezione e il
 * link dell'aula dell'insegnante: nessun dato degli alunni.
 *
 * lessonEvents() è il modello comune: lo usano il file .ics e il collegamento
 * diretto a Google Calendar (_shared/googlecalendar.ts), così i due mostrano le
 * stesse lezioni con gli stessi testi.
 */

export interface FeedGroup {
  id: string;
  title: string;
  status: string | null;
  archived_at: string | null;
  lesson_time: string | null;
  teacher_meeting_link: string | null;
  updated_at: string | null;
  course_title: string | null;
  course_emoji: string | null;
}

export interface FeedLesson {
  id: string;
  group_id: string;
  lesson_number: number;
  /** YYYY-MM-DD */
  lesson_date: string;
  /** HH:MM o HH:MM:SS, ora di Roma */
  lesson_time: string | null;
  lesson_title: string | null;
  updated_at: string;
}

/** La dashboard disegna le lezioni lunghe un'ora: qui lo stesso. */
export const LESSON_MINUTES = 60;
/** Lezioni passate tenute nel calendario. */
export const PAST_DAYS = 90;
/** Fin dove arrivano le lezioni future. */
export const FUTURE_DAYS = 400;

export const CALENDAR_NAME = "TECHLAND · Lezioni";
export const TZID = "Europe/Rome";
const UID_DOMAIN = "techlanditalia.it";

export const TOKEN_RE = /^[0-9a-f]{48}$/;

/** Token dal percorso (.../teacher-calendar-feed/<token>.ics) o da ?token=. */
export function tokenFromUrl(url: string): string | null {
  const u = new URL(url);
  const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
  const candidate = u.searchParams.get("token") ?? last.replace(/\.ics$/i, "");
  return TOKEN_RE.test(candidate) ? candidate : null;
}

/** Oggi a Roma, YYYY-MM-DD. */
export function romeToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZID }).format(now);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Intervallo di date delle lezioni da mettere nel calendario. */
export function feedWindow(now: Date): { from: string; to: string } {
  const today = romeToday(now);
  return { from: addDays(today, -PAST_DAYS), to: addDays(today, FUTURE_DAYS) };
}

/** Testo di SUMMARY, DESCRIPTION e LOCATION (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Righe al massimo di 75 byte (RFC 5545 §3.1): le successive cominciano con uno
 * spazio. Si spezza tra un carattere e l'altro, mai dentro un carattere UTF-8.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Solo link http(s) senza spazi: arrivano da un campo libero dell'admin. */
export function safeLink(value: string | null | undefined): string | null {
  const link = value?.trim();
  if (!link || !/^https?:\/\/[^\s"<>\\]+$/i.test(link)) return null;
  return link;
}

function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function parseTime(value: string | null | undefined): { h: number; m: number } | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

/** Data e ora "da orologio" di Roma (senza fuso) più i minuti: 2026-10-26T17:00:00. */
function localDateTime(date: string, time: { h: number; m: number }, plusMinutes = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, time.h, time.m + plusMinutes));
  return t.toISOString().slice(0, 19);
}

/** Inizio o fine di un evento: un giorno intero o data e ora di Roma. */
export type EventTime = { date: string } | { dateTime: string };

/** Una lezione come evento di calendario, prima di qualsiasi formato. */
export interface LessonEvent {
  /** id della riga di group_lesson_schedule */
  lessonId: string;
  summary: string;
  description: string;
  /** Link dell'aula, se c'è */
  location: string | null;
  /** Link dell'aula o, se non c'è, pagina del gruppo */
  url: string;
  start: EventTime;
  end: EventTime;
  /** Ultima modifica tra lezione e gruppo (ISO) */
  modified: string;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  `X-LIC-LOCATION:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * Le lezioni da mettere nel calendario: di un gruppo dell'insegnante e, se il
 * gruppo è archiviato, non oltre la data di archiviazione.
 */
export function feedLessons(groups: FeedGroup[], lessons: FeedLesson[]): FeedLesson[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return lessons
    .filter((l) => {
      const group = byId.get(l.group_id);
      if (!group) return false;
      if (group.status !== "archived" || !group.archived_at) return true;
      return l.lesson_date <= group.archived_at.slice(0, 10);
    })
    .sort((a, b) =>
      a.lesson_date.localeCompare(b.lesson_date) ||
      (a.lesson_time ?? byId.get(a.group_id)?.lesson_time ?? "").localeCompare(
        b.lesson_time ?? byId.get(b.group_id)?.lesson_time ?? "",
      ) ||
      a.lesson_number - b.lesson_number
    );
}

function lessonEvent(lesson: FeedLesson, group: FeedGroup, siteUrl: string): LessonEvent {
  const time = parseTime(lesson.lesson_time) ?? parseTime(group.lesson_time);
  const meeting = safeLink(group.teacher_meeting_link);
  const groupPage = `${siteUrl}/insegnante/gruppo/${group.id}`;
  const emoji = group.course_emoji?.trim() || "📚";
  const modified = [lesson.updated_at, group.updated_at]
    .filter((v): v is string => !!v)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const description = [
    group.course_title ? `Corso: ${group.course_title}` : null,
    lesson.lesson_title ? `Lezione ${lesson.lesson_number}: ${lesson.lesson_title}` : null,
    meeting ? `Entra in aula: ${meeting}` : null,
    `Gruppo su TECHLAND: ${groupPage}`,
  ].filter((v): v is string => !!v).join("\n");

  return {
    lessonId: lesson.id,
    summary: `${emoji} ${group.title} · Lezione ${lesson.lesson_number}`,
    description,
    location: meeting,
    url: meeting ?? groupPage,
    start: time ? { dateTime: localDateTime(lesson.lesson_date, time) } : { date: lesson.lesson_date },
    end: time
      ? { dateTime: localDateTime(lesson.lesson_date, time, LESSON_MINUTES) }
      : { date: addDays(lesson.lesson_date, 1) },
    modified,
  };
}

/** Le lezioni dell'insegnante come eventi, in ordine di data e ora. */
export function lessonEvents(groups: FeedGroup[], lessons: FeedLesson[], siteUrl: string): LessonEvent[] {
  const site = siteUrl.replace(/\/$/, "");
  const byId = new Map(groups.map((g) => [g.id, g]));
  return feedLessons(groups, lessons).map((l) => lessonEvent(l, byId.get(l.group_id)!, site));
}

const icsTime = (name: "DTSTART" | "DTEND", t: EventTime) =>
  "date" in t
    ? `${name};VALUE=DATE:${t.date.replace(/-/g, "")}`
    : `${name};TZID=${TZID}:${t.dateTime.replace(/[-:]/g, "")}`;

function eventLines(e: LessonEvent): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.lessonId}@${UID_DOMAIN}`,
    `DTSTAMP:${utcStamp(e.modified)}`,
    `LAST-MODIFIED:${utcStamp(e.modified)}`,
    icsTime("DTSTART", e.start),
    icsTime("DTEND", e.end),
    `SUMMARY:${escapeText(e.summary)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    `URL:${e.url}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ];
}

/** Il file .ics completo, con righe CRLF. */
export function buildTeacherCalendar(groups: FeedGroup[], lessons: FeedLesson[], siteUrl: string): string {
  const site = siteUrl.replace(/\/$/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TECHLAND//Lezioni insegnante//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `X-WR-CALDESC:${escapeText(`Le tue lezioni TECHLAND. Si aggiorna da solo; per i cambi dell'ultimo minuto fa fede la dashboard: ${site}/insegnante`)}`,
    `X-WR-TIMEZONE:${TZID}`,
    // Apple Calendar e Outlook lo rispettano; Google rilegge con i suoi tempi
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
    ...lessonEvents(groups, lessons, site).flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

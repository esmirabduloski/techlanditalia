import { describe, expect, it } from "vitest";
import {
  buildTeacherCalendar,
  escapeText,
  type FeedGroup,
  type FeedLesson,
  feedLessons,
  feedWindow,
  foldLine,
  romeToday,
  safeLink,
  tokenFromUrl,
} from "./teachercalendar.ts";

const SITE = "https://techlanditalia.it";
const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";

const group: FeedGroup = {
  id: "g1",
  title: "Python Lunedì",
  status: "active",
  archived_at: null,
  lesson_time: "17:00:00",
  teacher_meeting_link: "https://meet.google.com/abc-defg-hij",
  updated_at: "2026-10-01T08:00:00Z",
  course_title: "Python Base",
  course_emoji: "🐍",
};

const lesson = (over: Partial<FeedLesson> = {}): FeedLesson => ({
  id: "l1",
  group_id: "g1",
  lesson_number: 5,
  lesson_date: "2026-10-26",
  lesson_time: null,
  lesson_title: "Liste, cicli; e condizioni",
  updated_at: "2026-10-10T09:30:00Z",
  ...over,
});

/** Righe "srotolate" del calendario, come le legge un client. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");
const event = (ics: string, uid: string) => {
  const lines = unfold(ics);
  const start = lines.indexOf(`UID:${uid}@techlanditalia.it`);
  return lines.slice(start, lines.indexOf("END:VEVENT", start));
};

describe("tokenFromUrl", () => {
  it("legge il token dal percorso, con o senza .ics, o da ?token=", () => {
    expect(tokenFromUrl(`https://x.supabase.co/functions/v1/teacher-calendar-feed/${TOKEN}.ics`)).toBe(TOKEN);
    expect(tokenFromUrl(`https://x.supabase.co/functions/v1/teacher-calendar-feed/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromUrl(`https://x.supabase.co/functions/v1/teacher-calendar-feed?token=${TOKEN}`)).toBe(TOKEN);
  });

  it("scarta token di forma sbagliata", () => {
    expect(tokenFromUrl("https://x.supabase.co/functions/v1/teacher-calendar-feed")).toBeNull();
    expect(tokenFromUrl(`https://x.supabase.co/functions/v1/teacher-calendar-feed/${TOKEN.toUpperCase()}.ics`)).toBeNull();
    expect(tokenFromUrl("https://x.supabase.co/functions/v1/teacher-calendar-feed?token=' OR 1=1")).toBeNull();
  });
});

describe("date", () => {
  it("oggi è quello di Roma, anche a cavallo della mezzanotte UTC", () => {
    expect(romeToday(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
    expect(romeToday(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });

  it("tiene 90 giorni indietro e 400 avanti", () => {
    expect(feedWindow(new Date("2026-10-20T10:00:00Z"))).toEqual({ from: "2026-07-22", to: "2027-11-24" });
  });
});

describe("formato iCalendar", () => {
  it("fa l'escape di virgole, punti e virgola, backslash e a capo", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("spezza le righe a 75 byte senza tagliare le emoji", () => {
    const line = `SUMMARY:${"🐍".repeat(40)}`;
    const folded = foldLine(line).split("\r\n");
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(folded.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
    expect(foldLine("SUMMARY:corta")).toBe("SUMMARY:corta");
  });

  it("accetta solo link http(s) senza spazi", () => {
    expect(safeLink(" https://meet.google.com/x ")).toBe("https://meet.google.com/x");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("https://a.it/x\r\nATTENDEE:evil")).toBeNull();
    expect(safeLink("")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});

describe("feedLessons", () => {
  it("toglie le lezioni di altri gruppi e quelle dopo l'archiviazione", () => {
    const archived = { ...group, id: "g2", status: "archived", archived_at: "2026-11-01T10:00:00Z" };
    const lessons = [
      lesson({ id: "a", group_id: "g2", lesson_date: "2026-11-01" }),
      lesson({ id: "b", group_id: "g2", lesson_date: "2026-11-08" }),
      lesson({ id: "c", group_id: "altro" }),
      lesson({ id: "d" }),
    ];
    expect(feedLessons([group, archived], lessons).map((l) => l.id)).toEqual(["d", "a"]);
  });

  it("ordina per data e ora", () => {
    const lessons = [
      lesson({ id: "tardi", lesson_date: "2026-10-26", lesson_time: "18:30" }),
      lesson({ id: "dopo", lesson_date: "2026-10-27" }),
      lesson({ id: "presto", lesson_date: "2026-10-26", lesson_time: "09:00" }),
    ];
    expect(feedLessons([group], lessons).map((l) => l.id)).toEqual(["presto", "tardi", "dopo"]);
  });
});

describe("buildTeacherCalendar", () => {
  it("è un VCALENDAR con fuso di Roma e righe CRLF", () => {
    const ics = buildTeacherCalendar([group], [lesson()], SITE);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    const lines = unfold(ics);
    expect(lines).toContain("X-WR-CALNAME:TECHLAND · Lezioni");
    expect(lines).toContain("TZID:Europe/Rome");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("usa l'ora del gruppo se la lezione non ha la sua, e dura un'ora", () => {
    const ev = event(buildTeacherCalendar([group], [lesson()], SITE), "l1");
    expect(ev).toContain("DTSTART;TZID=Europe/Rome:20261026T170000");
    expect(ev).toContain("DTEND;TZID=Europe/Rome:20261026T180000");
  });

  it("l'ora della lezione vince su quella del gruppo, anche a cavallo della mezzanotte", () => {
    const ev = event(buildTeacherCalendar([group], [lesson({ lesson_time: "23:30" })], SITE), "l1");
    expect(ev).toContain("DTSTART;TZID=Europe/Rome:20261026T233000");
    expect(ev).toContain("DTEND;TZID=Europe/Rome:20261027T003000");
  });

  it("senza nessun orario è un evento di tutto il giorno", () => {
    const ev = event(buildTeacherCalendar([{ ...group, lesson_time: null }], [lesson()], SITE), "l1");
    expect(ev).toContain("DTSTART;VALUE=DATE:20261026");
    expect(ev).toContain("DTEND;VALUE=DATE:20261027");
  });

  it("titolo, descrizione e link dell'aula", () => {
    const ev = event(buildTeacherCalendar([group], [lesson()], SITE), "l1");
    expect(ev).toContain("SUMMARY:🐍 Python Lunedì · Lezione 5");
    expect(ev).toContain(
      "DESCRIPTION:Corso: Python Base\\nLezione 5: Liste\\, cicli\\; e condizioni\\n" +
        "Entra in aula: https://meet.google.com/abc-defg-hij\\n" +
        "Gruppo su TECHLAND: https://techlanditalia.it/insegnante/gruppo/g1",
    );
    expect(ev).toContain("LOCATION:https://meet.google.com/abc-defg-hij");
    expect(ev).toContain("URL:https://meet.google.com/abc-defg-hij");
    // L'aggiornamento più recente tra lezione e gruppo
    expect(ev).toContain("LAST-MODIFIED:20261010T093000Z");
  });

  it("senza link dell'aula rimanda al gruppo; un link non valido non entra nel calendario", () => {
    const ev = event(
      buildTeacherCalendar([{ ...group, teacher_meeting_link: "aula 3\nATTENDEE:x", course_emoji: null }], [lesson()], SITE),
      "l1",
    );
    expect(ev).toContain("URL:https://techlanditalia.it/insegnante/gruppo/g1");
    expect(ev.some((l) => l.startsWith("LOCATION:"))).toBe(false);
    expect(ev.some((l) => l.startsWith("ATTENDEE"))).toBe(false);
    expect(ev).toContain("SUMMARY:📚 Python Lunedì · Lezione 5");
  });

  it("calendario vuoto se non ci sono lezioni", () => {
    const ics = buildTeacherCalendar([group], [], SITE);
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VTIMEZONE\r\nEND:VCALENDAR");
  });
});

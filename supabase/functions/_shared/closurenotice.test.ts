import { describe, expect, it } from "vitest";
import {
  CLOSURES_PATH,
  closureNoticeEmail,
  closureNoticeMessage,
  closurePeriod,
  namesList,
  noticeDue,
} from "./closurenotice.ts";
import { forecastClosures, type ForecastClosure } from "./emailforecast.ts";

const SITE = "https://techlanditalia.it";
const immacolata = { title: "Immacolata Concezione", start_date: "2026-12-08", end_date: "2026-12-08", note: null };
const natale = {
  title: "Vacanze di Natale",
  start_date: "2026-12-23",
  end_date: "2027-01-06",
  note: "Le lezioni riprendono giovedì 7 gennaio",
};

describe("noticeDue", () => {
  it("parte da 3 giorni prima fino al giorno stesso, una volta sola", () => {
    expect(noticeDue({ today: "2026-12-04", startDate: "2026-12-08", notifiedAt: null })).toBe(false);
    expect(noticeDue({ today: "2026-12-05", startDate: "2026-12-08", notifiedAt: null })).toBe(true);
    expect(noticeDue({ today: "2026-12-08", startDate: "2026-12-08", notifiedAt: null })).toBe(true);
    expect(noticeDue({ today: "2026-12-09", startDate: "2026-12-08", notifiedAt: null })).toBe(false);
    expect(noticeDue({ today: "2026-12-05", startDate: "2026-12-08", notifiedAt: "2026-12-05T07:00:00Z" })).toBe(false);
  });
});

describe("testo dell'avviso", () => {
  it("scrive periodo e nomi in italiano", () => {
    expect(closurePeriod("2026-12-08", "2026-12-08")).toBe("martedì 8 dicembre");
    expect(closurePeriod("2026-12-23", "2027-01-06")).toBe("da mercoledì 23 dicembre a mercoledì 6 gennaio");
    expect(namesList(["Luca Rossi"])).toBe("Luca");
    expect(namesList(["Luca Rossi", "Giulia Rossi"])).toBe("Luca e Giulia");
    expect(namesList(["Luca Rossi", "Giulia Rossi", "Marco Rossi"])).toBe("Luca, Giulia e Marco");
  });

  it("un giorno solo, tre giorni prima", () => {
    expect(closureNoticeMessage({ closure: immacolata, studentNames: ["Luca Rossi"], today: "2026-12-05" })).toEqual({
      title: "📅 Martedì 8 dicembre niente lezioni",
      body: "Immacolata Concezione: TECHLAND è chiusa martedì 8 dicembre, quindi quel giorno Luca non ha lezione.",
    });
  });

  it("domani e oggi", () => {
    expect(closureNoticeMessage({ closure: immacolata, studentNames: ["Luca Rossi"], today: "2026-12-07" }).title)
      .toBe("📅 Domani, martedì 8 dicembre, niente lezioni");
    expect(closureNoticeMessage({ closure: immacolata, studentNames: ["Luca Rossi"], today: "2026-12-08" }).title)
      .toBe("📅 Oggi niente lezioni");
  });

  it("più giorni, più figli e la nota dell'admin", () => {
    expect(closureNoticeMessage({ closure: natale, studentNames: ["Luca Rossi", "Giulia Rossi"], today: "2026-12-20" })).toEqual({
      title: "📅 Niente lezioni dal 23 dicembre al 6 gennaio",
      body: "Vacanze di Natale: TECHLAND è chiusa da mercoledì 23 dicembre a mercoledì 6 gennaio, " +
        "quindi in quei giorni Luca e Giulia non hanno lezione. Le lezioni riprendono giovedì 7 gennaio.",
    });
  });

  it("allo studente senza genitore non nomina sé stesso", () => {
    expect(closureNoticeMessage({ closure: immacolata, studentNames: [], today: "2026-12-05" }).body)
      .toBe("Immacolata Concezione: TECHLAND è chiusa martedì 8 dicembre, quindi quel giorno non ci sono lezioni.");
  });

  it("email con saluto, link alle chiusure e dati escapati", () => {
    const msg = closureNoticeMessage({
      closure: { ...immacolata, title: "<script>x</script>", note: "Ci vediamo <b>giovedì</b>!" },
      studentNames: ["Luca Rossi"],
      today: "2026-12-05",
    });
    const email = closureNoticeEmail(msg, { parentName: "Anna Rossi", siteUrl: SITE });
    expect(email.subject).toBe("📅 Martedì 8 dicembre niente lezioni");
    expect(email.html).toContain("Ciao Anna,");
    expect(email.html).toContain(`${SITE}${CLOSURES_PATH}`);
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>giovedì</b>");
    expect(email.text).toContain("Ci vediamo <b>giovedì</b>!");
  });
});

describe("forecastClosures", () => {
  // 19 ottobre 2026, 10:00 a Roma: il job delle 07:00 UTC di oggi è già passato
  const NOW = new Date("2026-10-19T08:00:00Z");
  const closure = (over: Partial<ForecastClosure> = {}): ForecastClosure => ({
    title: "Ponte",
    start_date: "2026-10-30",
    end_date: "2026-11-01",
    note: null,
    notified_at: null,
    recipients: [
      { recipientId: "p1", recipientName: "Anna Rossi", recipientEmail: "anna@example.com", studentNames: ["Luca Rossi"] },
      { recipientId: "p2", recipientName: "Marco Verdi", recipientEmail: null, studentNames: ["Sara Verdi", "Leo Verdi"] },
    ],
    ...over,
  });

  it("un avviso per famiglia, 3 giorni prima, col canale giusto", () => {
    const items = forecastClosures({ closures: [closure()], now: NOW, days: 30, pushUsers: new Set(["p1", "p2"]) });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: "closure_notice",
      scheduledFor: "2026-10-27T07:00:00.000Z",
      recipientName: "Anna Rossi",
      studentName: "Luca Rossi",
      channel: "push_email",
      description: "Ponte: niente lezioni da venerdì 30 ottobre a domenica 1 novembre",
    });
    expect(items[1]).toMatchObject({ channel: "push", studentName: "Sara Verdi, Leo Verdi" });
  });

  it("recupera al prossimo giro se il giorno è già passato, salta quelle già avvisate o fuori finestra", () => {
    const soon = forecastClosures({ closures: [closure({ start_date: "2026-10-20", end_date: "2026-10-20" })], now: NOW, days: 30, pushUsers: new Set() });
    expect(soon.map((i) => i.scheduledFor)).toEqual(["2026-10-20T07:00:00.000Z", "2026-10-20T07:00:00.000Z"]);
    expect(forecastClosures({ closures: [closure({ notified_at: "2026-10-18T07:00:00Z" })], now: NOW, days: 30, pushUsers: new Set() })).toEqual([]);
    expect(forecastClosures({ closures: [closure({ start_date: "2026-12-23", end_date: "2027-01-06" })], now: NOW, days: 30, pushUsers: new Set() })).toEqual([]);
  });
});

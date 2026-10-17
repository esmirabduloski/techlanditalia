import { describe, expect, it } from "vitest";
import { certificateMessage, formatHours, studentPush } from "./certificates.ts";

describe("formatHours", () => {
  it("intere senza decimali, mezze ore con la virgola", () => {
    expect(formatHours(48)).toBe("48");
    expect(formatHours(1.5)).toBe("1,5");
  });
});

describe("certificateMessage", () => {
  const base = {
    parentName: "Maria Rossi",
    studentName: "Luca Rossi",
    courseTitle: "Sviluppo giochi con Roblox",
    teacherName: "Giulia Verdi",
    lessonsAttended: 31,
    hoursAttended: 46.5,
  };

  it("saluta il genitore e racconta lezioni e ore", () => {
    const msg = certificateMessage(base);
    expect(msg.subject).toBe("🎓 L'attestato di Luca è pronto");
    expect(msg.paragraphs[0]).toBe("Ciao Maria,");
    expect(msg.paragraphs[1]).toContain("31 lezioni e 46,5 ore di coding");
    expect(msg.paragraphs[1]).toContain("Giulia Verdi");
    expect(msg.paragraphs[2]).toContain("Certificazioni");
    expect(msg.pushBody).toContain("Sviluppo giochi con Roblox");
  });

  it("senza genitore un saluto generico, una lezione al singolare", () => {
    const msg = certificateMessage({ ...base, parentName: null, lessonsAttended: 1, hoursAttended: 1.5 });
    expect(msg.paragraphs[0]).toBe("Ciao,");
    expect(msg.paragraphs[1]).toContain("1 lezione e 1,5 ore");
  });
});

describe("studentPush", () => {
  it("si rivolge all'alunno per nome", () => {
    expect(studentPush({ studentName: "Luca Rossi", courseTitle: "Python" }).body).toBe(
      "Hai completato Python, Luca: lo trovi nella tua area riservata.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { certificateMessage, studentPush } from "./certificates.ts";

describe("certificateMessage", () => {
  const base = {
    parentName: "Maria Rossi",
    studentName: "Luca Rossi",
    courseTitle: "Sviluppo giochi con Roblox",
    teacherName: "Giulia Verdi",
  };

  it("saluta il genitore e racconta lezioni e ore (32 e 320 per tutti)", () => {
    const msg = certificateMessage(base);
    expect(msg.subject).toBe("🎓 L'attestato di Luca è pronto");
    expect(msg.paragraphs[0]).toBe("Ciao Maria,");
    expect(msg.paragraphs[1]).toContain("32 lezioni e 320 ore di coding");
    expect(msg.paragraphs[1]).toContain("Giulia Verdi");
    expect(msg.paragraphs[2]).toContain("Certificazioni");
    expect(msg.pushBody).toContain("Sviluppo giochi con Roblox");
  });

  it("senza genitore un saluto generico", () => {
    const msg = certificateMessage({ ...base, parentName: null });
    expect(msg.paragraphs[0]).toBe("Ciao,");
  });
});

describe("studentPush", () => {
  it("si rivolge all'alunno per nome", () => {
    expect(studentPush({ studentName: "Luca Rossi", courseTitle: "Python" }).body).toBe(
      "Hai completato Python, Luca: lo trovi nella tua area riservata.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { parseQuizContent } from "./quiz";

const quiz = (domande: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ titolo: "Quiz Python", domande, ...extra });

describe("parseQuizContent", () => {
  it("quiz valido a scelta multipla e vero/falso", () => {
    const r = parseQuizContent(
      quiz([
        { domanda: "Cosa stampa print(2+2)?", risposte_possibili: ["3", "4"], risposta_corretta: "4" },
        { tipo: "vero_falso", domanda: "Python è un linguaggio?", risposta_corretta: "vero", spiegazione: " Sì " },
      ]),
    );
    expect(r.kind).toBe("quiz");
    if (r.kind !== "quiz") return;
    expect(r.quiz.titolo).toBe("Quiz Python");
    expect(r.quiz.domande[0]).toMatchObject({ id: 1, tipo: "scelta_multipla", risposta_corretta: "4" });
    // vero/falso: opzioni fisse e risposta normalizzata alla maiuscola corretta
    expect(r.quiz.domande[1]).toMatchObject({
      id: 2,
      tipo: "vero_falso",
      risposte_possibili: ["Vero", "Falso"],
      risposta_corretta: "Vero",
      spiegazione: "Sì",
    });
  });

  it("collegamento a un'altra task quiz", () => {
    expect(parseQuizContent(JSON.stringify({ quiz_da_task: " abc-123 " }))).toEqual({ kind: "ref", taskId: "abc-123" });
  });

  it("errori comprensibili per chi scrive il quiz", () => {
    expect(parseQuizContent("")).toMatchObject({ kind: "error", message: "Il quiz è vuoto." });
    expect(parseQuizContent("{ domande: [ }")).toMatchObject({ kind: "error" });
    expect(parseQuizContent(quiz([]))).toMatchObject({ kind: "error" });
    expect(parseQuizContent(quiz([{ domanda: "", risposte_possibili: ["a", "b"], risposta_corretta: "a" }])))
      .toMatchObject({ kind: "error", message: expect.stringContaining("Domanda 1") });
    expect(parseQuizContent(quiz([{ domanda: "?", risposte_possibili: ["a"], risposta_corretta: "a" }])))
      .toMatchObject({ kind: "error", message: expect.stringContaining("almeno 2") });
  });

  it("la risposta corretta deve essere tra quelle possibili", () => {
    const r = parseQuizContent(
      quiz([
        { domanda: "Ok", risposte_possibili: ["a", "b"], risposta_corretta: "a" },
        { domanda: "Ko", risposte_possibili: ["a", "b"], risposta_corretta: "c" },
      ]),
    );
    expect(r).toMatchObject({ kind: "error", message: expect.stringContaining("Domanda 2") });
  });

  it("ignora le opzioni vuote", () => {
    const r = parseQuizContent(quiz([{ domanda: "?", risposte_possibili: ["a", " ", "b"], risposta_corretta: "b" }]));
    expect(r.kind === "quiz" && r.quiz.domande[0].risposte_possibili).toEqual(["a", "b"]);
  });
});

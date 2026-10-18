import { describe, expect, it } from "vitest";
import {
  agePhrase,
  combinedAgeRange,
  courseFactsFromRows,
  levelLabel,
  llmsCourseCards,
  llmsCourseList,
  llmsCourseTable,
  parseAgeRange,
  replaceSection,
  type CourseFacts,
} from "./courseFacts";

describe("parseAgeRange", () => {
  it("riconosce fasce chiuse e aperte", () => {
    expect(parseAgeRange("5-7 anni")).toEqual({ min: 5, max: 7 });
    expect(parseAgeRange("10–14 anni")).toEqual({ min: 10, max: 14 });
    expect(parseAgeRange("8+ anni")).toEqual({ min: 8, max: null });
    expect(parseAgeRange("")).toBeNull();
    expect(parseAgeRange(null)).toBeNull();
  });
});

describe("agePhrase", () => {
  it("usa l'articolo giusto", () => {
    expect(agePhrase("8+ anni")).toBe("dagli 8 anni");
    expect(agePhrase("13+ anni")).toBe("dai 13 anni");
    expect(agePhrase("5-7 anni")).toBe("dai 5 ai 7 anni");
    expect(agePhrase("8-10 anni")).toBe("dagli 8 ai 10 anni");
    expect(agePhrase("5-18 anni")).toBe("dai 5 ai 18 anni");
    expect(agePhrase("11-14 anni")).toBe("dagli 11 ai 14 anni");
  });

  it("stringa vuota se l'età non c'è", () => {
    expect(agePhrase(undefined)).toBe("");
  });
});

describe("combinedAgeRange", () => {
  it("parte dal minimo e chiude solo se tutti i corsi hanno un limite", () => {
    expect(combinedAgeRange(["5-7 anni", "5+ anni"])).toBe("5+ anni");
    expect(combinedAgeRange(["8-10 anni", "9-12 anni"])).toBe("8-12 anni");
    expect(combinedAgeRange(["13+ anni", "13+ anni"])).toBe("13+ anni");
  });

  it("vuota se manca l'età di un corso", () => {
    expect(combinedAgeRange(["8+ anni", undefined])).toBe("");
    expect(combinedAgeRange([])).toBe("");
  });
});

describe("levelLabel", () => {
  it("traduce i valori del DB nelle etichette pubbliche", () => {
    expect(levelLabel("base")).toBe("Principiante");
    expect(levelLabel("intermedio")).toBe("Intermedio");
    expect(levelLabel("Avanzato")).toBe("Avanzato");
    expect(levelLabel(null)).toBe("");
  });
});

describe("courseFactsFromRows", () => {
  it("indicizza per slug pubblico e normalizza i campi", () => {
    expect(
      courseFactsFromRows([
        {
          slug: "programmazione-visiva-con-scratch",
          title: "Programmazione visiva con Scratch",
          emoji: "🐱",
          description: " Giochi e animazioni ",
          level: "base",
          duration: "8 mesi",
          age_range: " 8-10 anni ",
        },
      ]),
    ).toEqual({
      scratch: {
        slug: "scratch",
        title: "Programmazione visiva con Scratch",
        emoji: "🐱",
        description: "Giochi e animazioni",
        level: "Principiante",
        duration: "8 mesi",
        ageRange: "8-10 anni",
      },
    });
  });
});

const course = (over: Partial<CourseFacts>): CourseFacts => ({
  slug: "x",
  title: "X",
  emoji: "",
  description: "",
  level: "Principiante",
  duration: "8 mesi",
  ageRange: "",
  ...over,
});
const python = course({ slug: "python-ai", title: "Python Avanzato", level: "Avanzato", ageRange: "13+ anni", description: "Bot e AI." });
const scratch = course({ slug: "scratch", title: "Scratch", ageRange: "8-10 anni", description: "Blocchi." });

describe("file per LLM", () => {
  it("llms.txt: elenco ordinato per età con nome, età e descrizione", () => {
    expect(llmsCourseList([python, scratch])).toEqual([
      "- [Scratch (8-10 anni)](https://techlanditalia.it/corsi/scratch): Blocchi.",
      "- [Python Avanzato (13+ anni)](https://techlanditalia.it/corsi/python-ai): Bot e AI.",
    ]);
  });

  it("llms-full.txt / corsi.md: una scheda per corso", () => {
    expect(llmsCourseCards([python])).toEqual([
      "### Python Avanzato",
      "- **Età**: 13+ anni",
      "- **Livello**: Avanzato",
      "- **Durata**: 8 mesi",
      "- **Descrizione**: Bot e AI.",
      "- **URL**: https://techlanditalia.it/corsi/python-ai",
    ]);
  });

  it("index.md: tabella età / corso / livello", () => {
    expect(llmsCourseTable([scratch])).toContain("| 8-10 anni | [Scratch](https://techlanditalia.it/corsi/scratch) | Principiante |");
  });
});

describe("replaceSection", () => {
  const text = ["# Titolo", "", "## Corsi", "", "- vecchio", "", "## Blog", "", "- blog"].join("\n");

  it("sostituisce il contenuto fino al titolo successivo", () => {
    expect(replaceSection(text, "## Corsi", ["- nuovo"])).toBe(
      ["# Titolo", "", "## Corsi", "", "- nuovo", "", "## Blog", "", "- blog"].join("\n"),
    );
  });

  it("si ferma anche a un separatore ---", () => {
    const withRule = ["## Catalogo", "", "### A", "", "---", "", "## FAQ"].join("\n");
    expect(replaceSection(withRule, "## Catalogo", ["### B"])).toBe(["## Catalogo", "", "### B", "", "---", "", "## FAQ"].join("\n"));
  });

  it("null se la sezione non esiste", () => {
    expect(replaceSection(text, "## Assente", [])).toBeNull();
  });
});

import { publicCourseSlug } from "./courseCatalog";

/**
 * Dati pubblici dei corsi: l'unica fonte è la tabella `courses` (nome, emoji,
 * descrizione breve, livello, durata, età). Schede /corsi, pagina corso,
 * homepage, blog, llms.txt e chat genitori mostrano questi valori così come
 * sono; nel codice non si riscrivono a mano. Il plugin Vite
 * `techland:course-facts` li legge a build-time per le parti statiche
 * (HTML prerenderato, homepage, file per LLM): vedi vite.config.ts.
 */
export interface CourseFacts {
  slug: string; // slug pubblico (corto)
  title: string;
  emoji: string;
  description: string;
  level: string; // etichetta: Principiante / Intermedio / Avanzato
  duration: string; // es. "8 mesi"
  ageRange: string; // es. "8+ anni"
}

/** slug pubblico → dati del corso */
export type CourseFactsMap = Record<string, CourseFacts>;

export interface CourseRow {
  slug: string;
  title: string | null;
  emoji: string | null;
  description: string | null;
  level: string | null;
  duration: string | null;
  age_range: string | null;
}

/** Colonne di `courses` da leggere per costruire i CourseFacts. */
export const COURSE_FACTS_COLUMNS = "slug,title,emoji,description,level,duration,age_range";

const LEVEL_LABELS: Record<string, string> = {
  base: "Principiante",
  intermedio: "Intermedio",
  avanzato: "Avanzato",
};

/** Valore di `courses.level` (base/intermedio/avanzato) → etichetta pubblica. */
export function levelLabel(level: string | null | undefined): string {
  const value = level?.trim() ?? "";
  return LEVEL_LABELS[value.toLowerCase()] ?? value;
}

export function courseFactsFromRow(row: CourseRow): CourseFacts {
  return {
    slug: publicCourseSlug(row.slug),
    title: row.title?.trim() ?? "",
    emoji: row.emoji?.trim() ?? "",
    description: row.description?.trim() ?? "",
    level: levelLabel(row.level),
    duration: row.duration?.trim() ?? "",
    ageRange: row.age_range?.trim() ?? "",
  };
}

export function courseFactsFromRows(rows: CourseRow[]): CourseFactsMap {
  return Object.fromEntries(rows.map(courseFactsFromRow).map((f) => [f.slug, f]));
}

/** Legge i corsi visibili dall'API REST pubblica (build-time e dev). */
export async function fetchCourseFacts(supabaseUrl: string | undefined, apikey: string | undefined): Promise<CourseFactsMap> {
  if (!supabaseUrl || !apikey) return {};
  const res = await fetch(`${supabaseUrl}/rest/v1/courses?select=${COURSE_FACTS_COLUMNS}&is_visible=eq.true`, {
    headers: { apikey, Authorization: `Bearer ${apikey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`courses: HTTP ${res.status}`);
  return courseFactsFromRows((await res.json()) as CourseRow[]);
}

// --- Età -------------------------------------------------------------------

export interface AgeBounds {
  min: number;
  max: number | null; // null = nessun limite superiore ("8+ anni")
}

export function parseAgeRange(ageRange: string | null | undefined): AgeBounds | null {
  if (!ageRange) return null;
  const range = ageRange.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const from = ageRange.match(/(\d+)/);
  return from ? { min: Number(from[1]), max: null } : null;
}

// "dagli 8" (otto), "dagli 11" (undici) ma "dai 13": l'articolo segue il suono del numero.
const elided = (n: number) => n === 8 || n === 11;
const da = (n: number) => `${elided(n) ? "dagli" : "dai"} ${n}`;
const a = (n: number) => `${elided(n) ? "agli" : "ai"} ${n}`;

/** "8+ anni" → "dagli 8 anni", "5-7 anni" → "dai 5 ai 7 anni"; "" se assente. */
export function agePhrase(ageRange: string | null | undefined): string {
  const bounds = parseAgeRange(ageRange);
  if (!bounds) return "";
  return bounds.max === null ? `${da(bounds.min)} anni` : `${da(bounds.min)} ${a(bounds.max)} anni`;
}

/**
 * Fascia che copre più corsi (tappe del percorso didattico): dal minimo dei
 * minimi; con limite superiore solo se tutti i corsi ne hanno uno.
 */
export function combinedAgeRange(ageRanges: (string | null | undefined)[]): string {
  const bounds = ageRanges.map(parseAgeRange);
  if (bounds.length === 0 || bounds.some((b) => b === null)) return "";
  const known = bounds as AgeBounds[];
  const min = Math.min(...known.map((b) => b.min));
  const max = known.every((b) => b.max !== null) ? Math.max(...known.map((b) => b.max as number)) : null;
  return max === null ? `${min}+ anni` : `${min}-${max} anni`;
}

/** Corsi in ordine di età d'ingresso, poi per nome (come la pagina /corsi). */
export function sortByAge(courses: CourseFacts[]): CourseFacts[] {
  const min = (c: CourseFacts) => parseAgeRange(c.ageRange)?.min ?? Number.POSITIVE_INFINITY;
  return [...courses].sort((x, y) => min(x) - min(y) || x.title.localeCompare(y.title, "it"));
}

// --- File per LLM (llms.txt, llms-full.txt, corsi.md, index.md) -------------

const courseUrl = (slug: string) => `https://techlanditalia.it/corsi/${slug}`;

const withAge = (c: CourseFacts) => (c.ageRange ? `${c.title} (${c.ageRange})` : c.title);

/** Elenco di llms.txt: `- [Nome (età)](url): descrizione` */
export function llmsCourseList(courses: CourseFacts[]): string[] {
  return sortByAge(courses).map((c) => `- [${withAge(c)}](${courseUrl(c.slug)})${c.description ? `: ${c.description}` : ""}`);
}

/** Schede di llms-full.txt e corsi.md. */
export function llmsCourseCards(courses: CourseFacts[]): string[] {
  return sortByAge(courses).flatMap((c, i) => [
    ...(i > 0 ? [""] : []),
    `### ${c.title}`,
    ...(c.ageRange ? [`- **Età**: ${c.ageRange}`] : []),
    ...(c.level ? [`- **Livello**: ${c.level}`] : []),
    ...(c.duration ? [`- **Durata**: ${c.duration}`] : []),
    ...(c.description ? [`- **Descrizione**: ${c.description}`] : []),
    `- **URL**: ${courseUrl(c.slug)}`,
  ]);
}

/** Tabella di index.md: età, corso, livello. */
export function llmsCourseTable(courses: CourseFacts[]): string[] {
  return [
    "| Età | Corso | Livello |",
    "|---|---|---|",
    ...sortByAge(courses).map((c) => `| ${c.ageRange} | [${c.title}](${courseUrl(c.slug)}) | ${c.level} |`),
    "",
    "[Vedi tutti i corsi →](https://techlanditalia.it/corsi)",
  ];
}

/**
 * Sostituisce il contenuto di una sezione (dalla riga `heading` alla prossima
 * `## ` o `---`, escluse) con `body`, lasciando una riga vuota prima e dopo.
 * `null` se il titolo non c'è.
 */
export function replaceSection(text: string, heading: string, body: string[]): string | null {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && (l.startsWith("## ") || l.trim() === "---"));
  if (end === -1) end = lines.length;
  return [...lines.slice(0, start + 1), "", ...body, "", ...lines.slice(end)].join("\n");
}

/** Sezione del catalogo da rigenerare in ogni file per LLM. */
export const LLM_CATALOG_SECTIONS: Record<string, { heading: string; body: (courses: CourseFacts[]) => string[] }> = {
  "llms.txt": { heading: "## Corsi di programmazione", body: llmsCourseList },
  "llms-full.txt": { heading: "## Catalogo Corsi Completo", body: llmsCourseCards },
  "corsi.md": { heading: "## Catalogo corsi", body: llmsCourseCards },
  "index.md": { heading: "## I nostri percorsi", body: llmsCourseTable },
};

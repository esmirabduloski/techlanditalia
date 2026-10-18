/**
 * Elenco corsi per il prompt della chat genitori, costruito dalla tabella
 * `courses`: nome, età, livello, durata e descrizione sono gli stessi del sito
 * e di llms.txt (vedi src/lib/courseFacts.ts, che qui non si può importare).
 */
export interface CatalogCourse {
  title: string;
  age_range: string | null;
  level: string | null;
  duration: string | null;
  description: string | null;
}

const LEVEL_LABELS: Record<string, string> = { base: "Principiante", intermedio: "Intermedio", avanzato: "Avanzato" };
const levelLabel = (level: string) => LEVEL_LABELS[level.trim().toLowerCase()] ?? level.trim();

const minAge = (ageRange: string | null) => {
  const m = ageRange?.match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};

export function courseCatalogLines(courses: CatalogCourse[]): string {
  if (courses.length === 0) {
    return "- L'elenco aggiornato dei corsi, con l'età consigliata di ciascuno, è su /corsi";
  }
  return [...courses]
    .sort((a, b) => minAge(a.age_range) - minAge(b.age_range) || a.title.localeCompare(b.title, "it"))
    .map((c) => {
      const meta = [
        c.age_range && `età ${c.age_range}`,
        c.level && `livello ${levelLabel(c.level)}`,
        c.duration && `durata ${c.duration}`,
      ].filter(Boolean).join(", ");
      const description = c.description?.trim();
      return `- ${c.title}${meta ? ` (${meta})` : ""}${description ? `: ${description}` : ""}`;
    })
    .join("\n");
}

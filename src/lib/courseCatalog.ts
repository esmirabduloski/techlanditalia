/**
 * Slug canonici del catalogo corsi (decisione SEO-010, luglio 2026):
 * ogni corso ha UN solo URL pubblico, /corsi/<slug corto>. Scratch e Minecraft
 * hanno ancora lo slug lungo storico nel DB: questa mappa collega i due mondi
 * senza scritture sul DB. Roblox e Python AI sono già stati rinominati nel DB
 * con lo slug corto, quindi non vanno tradotti (altrimenti la pagina non trova
 * il record e ignora contenuti e visibilità impostati dall'admin).
 */
export const SHORT_TO_DB_SLUG: Record<string, string> = {
  scratch: "programmazione-visiva-con-scratch",
  minecraft: "programmazione-visiva-con-minecraft",
};

/**
 * Slug lunghi → slug corto canonico. Include gli slug lunghi non più presenti
 * nel DB ma già indicizzati o linkati: reindirizzano (replace) al corto in
 * CorsoDettaglio.
 */
export const DB_TO_SHORT_SLUG: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SHORT_TO_DB_SLUG).map(([short, db]) => [db, short])),
  "sviluppo-giochi-con-roblox": "roblox",
  "python-avanzato": "python-ai",
};

/** Slug da usare nei link pubblici a partire da uno slug DB. */
export const publicCourseSlug = (dbSlug: string): string => DB_TO_SHORT_SLUG[dbSlug] ?? dbSlug;

/** Slug con cui interrogare il DB a partire dallo slug pubblico nell'URL. */
export const dbCourseSlug = (publicSlug: string): string => SHORT_TO_DB_SLUG[publicSlug] ?? publicSlug;

/**
 * Slug pubblico del corso più pertinente per un articolo del blog: prima le
 * keyword nel titolo/slug, poi la categoria, con fallback su Scratch
 * (il corso d'ingresso per il target genitori). Nome e descrizione del corso
 * si prendono dalla tabella courses (BUILD_COURSES), non da qui.
 */
export function recommendCourseSlugForPost(post: { title: string; slug: string; category: string }): string {
  const text = `${post.title} ${post.slug}`.toLowerCase();
  if (text.includes("roblox")) return "roblox";
  if (text.includes("minecraft")) return "minecraft";
  if (text.includes("scratch")) return "scratch";
  if (/\bai\b|intelligenza artificiale|machine learning/.test(text)) return "python-ai";
  if (text.includes("python")) return "python-base";
  if (/sito web|html|css|javascript|web/.test(text)) return "web-development";

  const byCategory: Record<string, string> = {
    Futuro: "python-ai",
    Tecnologia: "python-base",
    Gaming: "roblox",
    Tutorial: "scratch",
    Creatività: "scratch",
    Attività: "scratch",
  };
  return byCategory[post.category] ?? "scratch";
}

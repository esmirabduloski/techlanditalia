/**
 * Slug canonici del catalogo corsi (decisione SEO-010, luglio 2026):
 * ogni corso ha UN solo URL pubblico, /corsi/<slug corto>. Il DB usa ancora
 * gli slug lunghi storici: questa mappa collega i due mondi senza scritture
 * sul DB. Gli slug lunghi reindirizzano (replace) al corto in CorsoDettaglio.
 */
export const SHORT_TO_DB_SLUG: Record<string, string> = {
  roblox: "sviluppo-giochi-con-roblox",
  "python-ai": "python-avanzato",
  scratch: "programmazione-visiva-con-scratch",
  minecraft: "programmazione-visiva-con-minecraft",
};

export const DB_TO_SHORT_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_DB_SLUG).map(([short, db]) => [db, short]),
);

/** Slug da usare nei link pubblici a partire da uno slug DB. */
export const publicCourseSlug = (dbSlug: string): string => DB_TO_SHORT_SLUG[dbSlug] ?? dbSlug;

/** Slug con cui interrogare il DB a partire dallo slug pubblico nell'URL. */
export const dbCourseSlug = (publicSlug: string): string => SHORT_TO_DB_SLUG[publicSlug] ?? publicSlug;

export interface CourseSuggestion {
  slug: string; // slug pubblico (corto)
  title: string;
  blurb: string;
}

const SUGGESTIONS: Record<string, CourseSuggestion> = {
  scratch: {
    slug: "scratch",
    title: "Programmazione visiva con Scratch",
    blurb: "Il primo passo nel coding per i più piccoli: logica e creatività con i blocchi visuali.",
  },
  minecraft: {
    slug: "minecraft",
    title: "Programmazione visiva con Minecraft",
    blurb: "Imparare a programmare dentro il gioco che i bambini amano già.",
  },
  roblox: {
    slug: "roblox",
    title: "Sviluppo giochi con Roblox",
    blurb: "Creare veri videogiochi 3D con Roblox Studio e il linguaggio Lua.",
  },
  "python-base": {
    slug: "python-base",
    title: "Python Base",
    blurb: "Il linguaggio più richiesto al mondo, spiegato ai ragazzi con progetti pratici.",
  },
  "python-ai": {
    slug: "python-ai",
    title: "Python e Intelligenza Artificiale",
    blurb: "Python avanzato, machine learning e AI per ragazzi che vogliono andare oltre.",
  },
  "web-development": {
    slug: "web-development",
    title: "Web Development",
    blurb: "HTML, CSS e JavaScript per costruire il primo sito web da zero.",
  },
};

/**
 * Suggerisce il corso più pertinente per un articolo del blog: prima le
 * keyword nel titolo/slug, poi la categoria, con fallback su Scratch
 * (il corso d'ingresso per il target genitori).
 */
export function recommendCourseForPost(post: { title: string; slug: string; category: string }): CourseSuggestion {
  const text = `${post.title} ${post.slug}`.toLowerCase();
  if (text.includes("roblox")) return SUGGESTIONS.roblox;
  if (text.includes("minecraft")) return SUGGESTIONS.minecraft;
  if (text.includes("scratch")) return SUGGESTIONS.scratch;
  if (/\bai\b|intelligenza artificiale|machine learning/.test(text)) return SUGGESTIONS["python-ai"];
  if (text.includes("python")) return SUGGESTIONS["python-base"];
  if (/sito web|html|css|javascript|web/.test(text)) return SUGGESTIONS["web-development"];

  const byCategory: Record<string, CourseSuggestion> = {
    Futuro: SUGGESTIONS["python-ai"],
    Tecnologia: SUGGESTIONS["python-base"],
    Gaming: SUGGESTIONS.roblox,
    Tutorial: SUGGESTIONS.scratch,
    Creatività: SUGGESTIONS.scratch,
    Attività: SUGGESTIONS.scratch,
  };
  return byCategory[post.category] ?? SUGGESTIONS.scratch;
}

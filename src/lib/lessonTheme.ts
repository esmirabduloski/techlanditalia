/**
 * Identità visiva delle pagine lezione: colore per corso e icona per tipo di task.
 * Le classi `course-theme-*` (in index.css) ridefiniscono --primary/--ring solo
 * dentro la pagina lezione, così pulsanti, stepper e badge prendono il colore del corso.
 */

const COURSE_THEMES: Array<{ match: RegExp; className: string }> = [
  { match: /(^|-)ai($|-)|intelligenza/, className: 'course-theme-ai' },
  { match: /python/, className: 'course-theme-python' },
  { match: /web|html/, className: 'course-theme-web' },
  { match: /scratch/, className: 'course-theme-scratch' },
  { match: /roblox/, className: 'course-theme-roblox' },
];

/** Classe tema per il corso; stringa vuota = verde Techland di default (es. Minecraft). */
export function getCourseThemeClass(slug: string | null | undefined): string {
  if (!slug) return '';
  return COURSE_THEMES.find(t => t.match.test(slug))?.className ?? '';
}

export interface TaskTypeMeta {
  emoji: string;
  label: string;
}

const TASK_TYPES: Record<string, TaskTypeMeta> = {
  text: { emoji: '📖', label: 'Teoria' },
  slides: { emoji: '🖼️', label: 'Presentazione' },
  mixed: { emoji: '💻', label: 'Codice' },
  scratch: { emoji: '🐱', label: 'Scratch' },
  quiz: { emoji: '❓', label: 'Quiz' },
};

export function getTaskTypeMeta(contentType: string | null | undefined): TaskTypeMeta {
  return TASK_TYPES[contentType || 'text'] ?? TASK_TYPES.text;
}

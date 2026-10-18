import courses from "virtual:course-facts";
import type { CourseFactsMap } from "./courseFacts";

/**
 * Dati dei corsi letti dalla tabella `courses` a build-time (plugin
 * `techland:course-facts` in vite.config.ts), per i contenuti statici:
 * HTML prerenderato, homepage, testi. Vuoto se il DB non era raggiungibile:
 * chi li usa nasconde il dato invece di mostrarne uno inventato.
 */
export const BUILD_COURSES: CourseFactsMap = courses;

/**
 * Quale compilatore apre un task o un compito: dipende dal corso (slug) e,
 * per Python, dall'ambiente scelto dall'admin. Usata da task, compiti e viste
 * insegnante, così tutte le pagine aprono lo stesso compilatore.
 */

export const PYTHON_COURSES = ['python-base', 'python-ai', 'python-avanzato'];
export const WEB_COURSES = ['web-development'];

export type CompilerKind = 'python' | 'turtle' | 'pgzero' | 'web';

// Turtle anche quando l'ambiente non è impostato ma il codice di partenza importa turtle
const TURTLE_IMPORT = /^\s*(import turtle|from turtle)/m;

export function resolveCompiler(
  courseSlug: string | null | undefined,
  task: { python_env?: string | null; default_python_code?: string | null },
): CompilerKind | null {
  if (!courseSlug) return null;
  if (PYTHON_COURSES.includes(courseSlug)) {
    if (task.python_env === 'turtle' || TURTLE_IMPORT.test(task.default_python_code || '')) return 'turtle';
    if (task.python_env === 'pgzero') return 'pgzero';
    return 'python';
  }
  if (WEB_COURSES.includes(courseSlug)) return 'web';
  return null;
}

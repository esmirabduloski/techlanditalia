/**
 * Anteprima delle consegne nella valutazione (insegnante e admin): che tipo di
 * file è, quale compilatore riapre il codice dello studente, link Scratch da
 * incorporare. Solo funzioni pure, così le due pagine di valutazione e i test
 * condividono le stesse regole.
 */
import { resolveCompiler, type CompilerKind } from '@/lib/compilerKind';

export type FilePreviewKind =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'scratch'
  | 'python'
  | 'html'
  | 'code'
  | 'other';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const VIDEO_EXT = ['mp4', 'webm'];
const AUDIO_EXT = ['mp3', 'wav'];
const OTHER_CODE_EXT = ['css', 'js', 'ts', 'tsx', 'json', 'lua', 'md', 'txt'];

export function fileExtension(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/** Come mostrare un file consegnato: decide l'estensione, il tipo MIME fa da riserva. */
export function filePreviewKind(fileName: string | null | undefined, fileType?: string | null): FilePreviewKind {
  const ext = fileExtension(fileName);
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (ext === 'sb3') return 'scratch';
  if (ext === 'py') return 'python';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (OTHER_CODE_EXT.includes(ext)) return 'code';

  const type = (fileType || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'other';
}

/** File il cui contenuto va letto come testo per mostrarlo o aprirlo nel compilatore */
export function isTextPreview(kind: FilePreviewKind): boolean {
  return kind === 'python' || kind === 'html' || kind === 'code';
}

// scratch.mit.edu/projects/123, anche con /editor, /fullscreen, #player; turbowarp.org/123
const SCRATCH_PROJECT = /https?:\/\/(?:www\.)?scratch\.mit\.edu\/projects\/(\d+)/i;
const TURBOWARP_PROJECT = /https?:\/\/(?:www\.)?turbowarp\.org\/(\d+)/i;

/** Id del progetto Scratch citato nel testo della consegna (di solito le note) */
export function scratchProjectId(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(SCRATCH_PROJECT) ?? text.match(TURBOWARP_PROJECT);
  return match ? match[1] : null;
}

/** Player ufficiale: funziona solo per i progetti condivisi dallo studente */
export function scratchEmbedUrl(projectId: string): string {
  return `https://scratch.mit.edu/projects/${projectId}/embed`;
}

export function scratchProjectUrl(projectId: string): string {
  return `https://scratch.mit.edu/projects/${projectId}/`;
}

/**
 * Player TurboWarp (compatibile Scratch) per un .sb3 privato: riceve il link
 * firmato temporaneo e scarica il file direttamente nel browser dell'insegnante.
 */
export function turbowarpEmbedUrl(projectFileUrl: string): string {
  return `https://turbowarp.org/embed?project_url=${encodeURIComponent(projectFileUrl)}`;
}

// Formato scritto da HomeworkView alla consegna dal compilatore Web
const HTML_MARK = '<!-- HTML -->\n';
const CSS_MARK = '\n\n/* CSS */\n';
const JS_MARK = '\n\n// JavaScript\n';

export interface WebCode {
  html: string;
  css: string;
  js: string;
}

export function isWebCode(code: string): boolean {
  return code.startsWith(HTML_MARK.trimEnd());
}

/** Divide la consegna Web nei tre file; null se non è nel formato del compilatore */
export function splitWebCode(code: string): WebCode | null {
  if (!isWebCode(code)) return null;
  const body = code.slice(HTML_MARK.trimEnd().length).replace(/^\n/, '');
  const cssAt = body.indexOf(CSS_MARK);
  if (cssAt === -1) return { html: body, css: '', js: '' };
  const html = body.slice(0, cssAt);
  const rest = body.slice(cssAt + CSS_MARK.length);
  // L'ultimo segnaposto JS: il CSS dello studente potrebbe contenere lo stesso commento
  const jsAt = rest.lastIndexOf(JS_MARK);
  if (jsAt === -1) return { html, css: rest, js: '' };
  return { html, css: rest.slice(0, jsAt), js: rest.slice(jsAt + JS_MARK.length) };
}

const TURTLE_IMPORT = /^\s*(import turtle|from turtle)/m;
const PGZERO_IMPORT = /^\s*(import pgzrun|from pgzero|import pgzero)/m;

export interface ReviewHomework {
  python_env?: string | null;
  default_python_code?: string | null;
}

/**
 * Compilatore con cui riaprire il codice consegnato: lo stesso del compito
 * (vedi resolveCompiler); se il corso non lo indica si deduce dal codice.
 */
export function reviewCompiler(
  courseSlug: string | null | undefined,
  homework: ReviewHomework,
  code: string,
): CompilerKind {
  if (isWebCode(code)) return 'web';
  const fromCourse = resolveCompiler(courseSlug, homework);
  if (fromCourse === 'turtle' || fromCourse === 'pgzero') return fromCourse;
  if (TURTLE_IMPORT.test(code)) return 'turtle';
  if (PGZERO_IMPORT.test(code)) return 'pgzero';
  return 'python';
}

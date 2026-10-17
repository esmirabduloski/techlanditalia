/**
 * Attestati di fine corso (drizzle/migrations/0050_course_certificates.sql).
 * Qui solo logica pura: riempire il modello SVG (src/assets/certificates/attestato.svg)
 * e decidere quando si sbloccano. Il PDF lo genera certificatePdf.ts nel browser.
 */
import type { Tables } from '@/integrations/supabase/types';
import { shortDate } from '@/lib/courseProposal';

export type CourseCertificate = Tables<'course_certificates'>;

/** Campi dell'attestato usati dal modello. */
export type CertificateData = Pick<
  CourseCertificate,
  | 'student_name'
  | 'course_title'
  | 'teacher_name'
  | 'hard_skills'
  | 'soft_skills'
  | 'issued_on'
  | 'code'
>;

export const MAX_HARD_SKILLS = 5;
export const MAX_SOFT_SKILLS = 4;
/** Oltre questa lunghezza una competenza non sta sulla riga dell'attestato. */
export const CERTIFICATE_SKILL_MAX_CHARS = 40;
/**
 * Lezioni e ore stampate sull'attestato: uguali per tutti, a prescindere dalle
 * presenze nel registro (che restano in lessons_attended/hours_attended).
 */
export const CERTIFICATE_LESSONS = 32;
export const CERTIFICATE_HOURS = 320;

/** 45 → "45", 1.5 → "1,5". */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toLocaleString('it-IT', { maximumFractionDigits: 1 });
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Valori dei segnaposto {{...}} del modello. */
export function certificateValues(c: CertificateData): Record<string, string> {
  const values: Record<string, string> = {
    NOME: c.student_name.trim(),
    CORSO: c.course_title.trim(),
    LEZIONI: String(CERTIFICATE_LESSONS),
    TOTALE: String(CERTIFICATE_LESSONS),
    ORE: formatHours(CERTIFICATE_HOURS),
    DATA: shortDate(c.issued_on),
    INSEGNANTE: c.teacher_name.trim(),
    CODICE: c.code,
  };
  for (let i = 0; i < MAX_HARD_SKILLS; i++) values[`HARD_${i + 1}`] = (c.hard_skills[i] ?? '').trim();
  for (let i = 0; i < MAX_SOFT_SKILLS; i++) values[`SOFT_${i + 1}`] = (c.soft_skills[i] ?? '').trim();
  return values;
}

/** Il nome sta su una riga: oltre i 22 caratteri il carattere si riduce. */
export function nameFontSize(name: string, base = 44): number {
  const len = name.trim().length;
  if (len <= 22) return base;
  return Math.max(26, Math.floor((base * 22) / len));
}

/** Come per il nome, ma per il titolo del corso. */
export function courseFontSize(title: string, base = 21): number {
  const len = title.trim().length;
  if (len <= 40) return base;
  return Math.max(14, Math.floor((base * 40) / len));
}

function setFontSize(svg: string, id: string, size: number): string {
  return svg.replace(new RegExp(`(<text[^>]*\\bid="${id}"[^>]*\\bfont-size=")[^"]*(")`), `$1${size}$2`);
}

/**
 * Riempie il modello SVG: sostituisce i segnaposto (con escape XML), toglie le
 * righe delle competenze vuote (gruppi con data-slot) e riduce nome e corso
 * se sono troppo lunghi.
 */
export function fillCertificateSvg(template: string, c: CertificateData): string {
  const values = certificateValues(c);
  let svg = template.replace(/<g data-slot="([A-Z_0-9]+)">[\s\S]*?<\/g>/g, (group, key: string) =>
    values[key] ? group : '',
  );
  svg = setFontSize(svg, 'cert-name', nameFontSize(values.NOME));
  svg = setFontSize(svg, 'cert-course', courseFontSize(values.CORSO));
  // Solo i segnaposto noti: un {{...}} sconosciuto resta visibile, così si nota
  return svg.replace(/\{\{([A-Z_0-9]+)\}\}/g, (match, key: string) =>
    key in values ? xmlEscape(values[key]) : match,
  );
}

/** "Attestato-Giulia-Bianchi-Sviluppo-giochi-con-Roblox.pdf" */
export function certificateFileName(c: Pick<CertificateData, 'student_name' | 'course_title'>): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `Attestato-${slug(c.student_name)}-${slug(c.course_title)}.pdf`;
}

/**
 * Gli attestati si sbloccano dal giorno dell'ultima lezione (la max_lessons
 * del calendario). Senza data in calendario basta che la presenza
 * dell'ultima lezione sia segnata. Stessa regola di release_group_certificates.
 */
export function certificatesUnlocked(opts: {
  today: string;
  lastLessonDate: string | null;
  lastLessonMarked: boolean;
}): boolean {
  if (opts.lastLessonDate) return opts.today >= opts.lastLessonDate;
  return opts.lastLessonMarked;
}

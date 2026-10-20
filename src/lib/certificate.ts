/**
 * Attestati di fine corso (drizzle/migrations/0050_course_certificates.sql) e
 * loro verifica e condivisione (0064_certificate_sharing.sql).
 * Qui solo logica pura: riempire il modello SVG (src/assets/certificates/attestato.svg),
 * decidere quando si sbloccano e costruire i link pubblici. Il PDF lo genera
 * certificatePdf.ts nel browser.
 */
import { shortDate } from '@/lib/courseProposal';
import type { QrPath } from '@/lib/qrCode';

/** Contratto della 0050, disponibile anche prima di applicarla al database. */
export type CourseCertificate = {
  id: string;
  student_id: string;
  group_id: string;
  student_name: string;
  course_title: string;
  course_emoji: string | null;
  teacher_name: string;
  lessons_attended: number;
  lessons_total: number;
  hours_attended: number;
  hard_skills: string[];
  soft_skills: string[];
  issued_on: string;
  code: string;
  released_by: string | null;
  notified_at: string | null;
  created_at: string;
  /**
   * Contratto della 0064: NULL = privato. Prima che la migrazione sia
   * applicata le colonne mancano del tutto (vedi sharingAvailable).
   */
  shared_at?: string | null;
  shared_by?: string | null;
  shared_as?: 'parent' | 'student' | null;
};

/** Riga di verify_certificate(): se l'attestato è privato, iniziali e niente competenze. */
export type VerifiedCertificate = {
  code: string;
  is_public: boolean;
  student_name: string;
  course_title: string;
  course_emoji: string | null;
  teacher_name: string | null;
  issued_on: string;
  hard_skills: string[];
  soft_skills: string[];
};

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

/** Valori dei segnaposto {{...}} del modello; senza QR il suo riquadro sparisce. */
export function certificateValues(c: CertificateData, qr?: QrPath): Record<string, string> {
  const values: Record<string, string> = {
    NOME: c.student_name.trim(),
    CORSO: c.course_title.trim(),
    LEZIONI: String(CERTIFICATE_LESSONS),
    TOTALE: String(CERTIFICATE_LESSONS),
    ORE: formatHours(CERTIFICATE_HOURS),
    DATA: shortDate(c.issued_on),
    INSEGNANTE: c.teacher_name.trim(),
    CODICE: c.code,
    QR_SIZE: String(qr?.size ?? 0),
    QR_PATH: qr?.d ?? '',
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
 * righe delle competenze vuote e il QR mancante (gruppi con data-slot) e
 * riduce nome e corso se sono troppo lunghi.
 */
export function fillCertificateSvg(template: string, c: CertificateData, qr?: QrPath): string {
  const values = certificateValues(c, qr);
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

// --- Verifica e condivisione (0064) ---

export const CERTIFICATE_SITE = 'https://techlanditalia.it';
/** Pagina pubblica di verifica: /attestato (modulo) e /attestato/<codice>. */
export const CERTIFICATE_VERIFY_PATH = '/attestato';

/** Link pubblico dell'attestato, lo stesso del QR stampato sul PDF. */
export function certificateUrl(code: string): string {
  return `${CERTIFICATE_SITE}${CERTIFICATE_VERIFY_PATH}/${encodeURIComponent(code)}`;
}

/**
 * Codice scritto a mano o link incollato → codice da cercare, oppure null se
 * non può essere un codice. Stessa normalizzazione di verify_certificate().
 */
export function normalizeCertificateCode(input: string): string | null {
  const raw = input.trim();
  const fromUrl = raw.match(/\/attestato\/([^/?#\s]+)/i);
  // "TL 2026 7K3QF" e "TL - 2026 - 7K3QF" valgono come TL-2026-7K3QF
  const code = (fromUrl ? decodeURIComponent(fromUrl[1]) : raw).replace(/\s*-\s*|\s+/g, '-').toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{3,38}[A-Z0-9]$/.test(code) ? code : null;
}

/** La 0064 è applicata quando la riga ha la colonna shared_at (anche NULL). */
export function sharingAvailable(c: Partial<CourseCertificate>): boolean {
  return 'shared_at' in c;
}

export function isCertificatePublic(c: Partial<CourseCertificate>): boolean {
  return !!c.shared_at;
}

/**
 * "Aggiungi al profilo" di LinkedIn, sezione Licenze e certificazioni, già
 * compilata. TECHLAND non ha una pagina aziendale: va il nome, senza logo.
 */
export function linkedInAddToProfileUrl(c: Pick<CertificateData, 'course_title' | 'issued_on' | 'code'>): string {
  const [year, month] = c.issued_on.split('-');
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: c.course_title.trim(),
    organizationName: 'TECHLAND',
    issueYear: String(Number(year)),
    issueMonth: String(Number(month)),
    certUrl: certificateUrl(c.code),
    certId: c.code,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

/** Stesso nome del PDF, in .png: l'immagine da condividere. */
export function certificateImageFileName(c: Pick<CertificateData, 'student_name' | 'course_title'>): string {
  return certificateFileName(c).replace(/\.pdf$/, '.png');
}

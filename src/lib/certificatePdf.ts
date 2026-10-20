/**
 * Attestato in PDF e immagine da condividere, generati nel browser dal modello
 * SVG (src/assets/certificates/attestato.svg). Si carica solo quando serve, con
 * import() dinamico: modello, font, QR e jsPDF non pesano sul resto dell'app.
 *
 * L'SVG riempito diventa un'immagine a 300 dpi su un PDF A4 orizzontale: così
 * il PDF è identico all'anteprima, su tutti i telefoni, con i font del marchio
 * incorporati (un SVG usato come immagine non vede i font della pagina).
 */
import template from '@/assets/certificates/attestato.svg?raw';
import font400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url';
import font600 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2?url';
import font800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2?url';
import {
  CERTIFICATE_VERIFY_PATH,
  certificateFileName,
  certificateImageFileName,
  certificateUrl,
  fillCertificateSvg,
  type CertificateData,
} from '@/lib/certificate';
import { qrPath } from '@/lib/qrCode';

export interface RenderOptions {
  /**
   * Con il QR code che porta alla pagina di verifica. Solo quando la pagina
   * esiste davvero (0064 applicata, vedi sharingAvailable).
   */
  verifiable?: boolean;
}

// A4 orizzontale in punti (come il viewBox del modello) e a 300 dpi
const PAGE_W = 842;
const PAGE_H = 595;
const DPI_SCALE = 300 / 72;

let fontCss: Promise<string> | null = null;

async function toBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** @font-face di Plus Jakarta Sans con i file incorporati (una volta sola). */
function embeddedFonts(): Promise<string> {
  fontCss ??= Promise.all(
    ([[400, font400], [600, font600], [800, font800]] as const).map(
      async ([weight, url]) =>
        `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:${weight};` +
        `src:url(data:font/woff2;base64,${await toBase64(url)}) format('woff2')}`,
    ),
  )
    .then((faces) => faces.join(''))
    .catch((e) => {
      fontCss = null;
      throw e;
    });
  return fontCss;
}

/** SVG dell'attestato pronto da mostrare, con i font incorporati. */
export async function certificateSvg(c: CertificateData, opts: RenderOptions = {}): Promise<string> {
  const css = await embeddedFonts();
  const qr = opts.verifiable ? qrPath(certificateUrl(c.code)) : undefined;
  return fillCertificateSvg(template, c, qr).replace(/<defs>/, `<defs><style>${css}</style>`);
}

/** Anteprima per <img>: stesso disegno del PDF. */
export async function certificatePreviewUrl(c: CertificateData, opts: RenderOptions = {}): Promise<string> {
  const svg = await certificateSvg(c, opts);
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile disegnare l'attestato"));
    img.src = url;
  });
}

/** Safari a volte disegna un SVG appena caricato senza i font: un attimo di respiro. */
const fontsSettle = () => new Promise((r) => setTimeout(r, 50));

/** PDF dell'attestato (A4 orizzontale). */
export async function certificatePdfBlob(c: CertificateData, opts: RenderOptions = {}): Promise<Blob> {
  const [{ jsPDF }, url] = await Promise.all([import('jspdf'), certificatePreviewUrl(c, opts)]);
  try {
    const img = await loadImage(url);
    await fontsSettle();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(PAGE_W * DPI_SCALE);
    canvas.height = Math.round(PAGE_H * DPI_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossibile disegnare l'attestato");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    pdf.setProperties({ title: `Attestato di ${c.student_name}`, subject: c.course_title, author: 'TECHLAND', creator: 'TECHLAND' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
    return pdf.output('blob');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Scarica il PDF con un nome leggibile. */
export async function downloadCertificatePdf(c: CertificateData, opts: RenderOptions = {}): Promise<void> {
  saveBlob(await certificatePdfBlob(c, opts), certificateFileName(c));
}

// --- Immagine da condividere (Instagram, storie, post LinkedIn) ---

// 4:5, il formato verticale più grande del feed di Instagram; nelle storie
// resta intera, e va bene anche per un post LinkedIn.
const SHARE_W = 1080;
const SHARE_H = 1350;
const SHARE_CERT = { x: 60, y: 430, w: 960, h: Math.round((960 * PAGE_H) / PAGE_W), r: 22 };

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Titolo del corso su una riga: oltre i 18 caratteri il carattere si riduce. */
export function shareTitleFontSize(title: string, base = 76): number {
  const len = title.trim().length;
  if (len <= 18) return base;
  return Math.max(40, Math.floor((base * 18) / len));
}

/** Sfondo dell'immagine (testi e cornice): l'attestato ci viene disegnato sopra. */
function shareBackgroundSvg(c: CertificateData, css: string): string {
  const { x, y, w, h, r } = SHARE_CERT;
  const link = `techlanditalia.it${CERTIFICATE_VERIFY_PATH}/${c.code}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_W}" height="${SHARE_H}" viewBox="0 0 ${SHARE_W} ${SHARE_H}" font-family="'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <style>${css}</style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="#ffffff" opacity=".14"/></pattern>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#bg)"/>
  <rect width="${SHARE_W}" height="${SHARE_H}" fill="url(#dots)"/>
  <g text-anchor="middle" fill="#ffffff">
    <text x="540" y="118" font-size="34" font-weight="800" letter-spacing="2">&lt;/&gt;</text>
    <text x="540" y="168" font-size="40" font-weight="800" letter-spacing="6">TECHLAND</text>
    <text x="540" y="274" font-size="42" font-weight="600" opacity=".95">Ho completato il corso</text>
    <text x="540" y="366" font-size="${shareTitleFontSize(c.course_title)}" font-weight="800">${xml(c.course_title.trim())}</text>
  </g>
  <rect x="${x}" y="${y + 18}" width="${w}" height="${h}" rx="${r}" fill="#064e3b" opacity=".35" filter="url(#shadow)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff"/>
  <g transform="translate(140 1166)">
    <rect width="800" height="104" rx="52" fill="#ffffff"/>
    <circle cx="62" cy="52" r="26" fill="#10b981"/>
    <path d="M50 52.5 l8 8.5 l15 -17" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="108" y="44" font-size="28" font-weight="800" fill="#047857">Attestato verificato</text>
    <text x="108" y="80" font-size="25" font-weight="600" fill="#0f2e24">${xml(link)}</text>
  </g>
  <text x="540" y="1318" text-anchor="middle" font-size="24" font-weight="600" fill="#ffffff" opacity=".9">Scuola di coding per ragazzi</text>
</svg>`;
}

/** PNG 1080x1350 con l'attestato (QR compreso) e il link di verifica. */
export async function certificateShareImageBlob(c: CertificateData): Promise<Blob> {
  const css = await embeddedFonts();
  const bgUrl = URL.createObjectURL(new Blob([shareBackgroundSvg(c, css)], { type: 'image/svg+xml' }));
  const certUrl = await certificatePreviewUrl(c, { verifiable: true });
  try {
    const [bg, cert] = await Promise.all([loadImage(bgUrl), loadImage(certUrl)]);
    await fontsSettle();
    const canvas = document.createElement('canvas');
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossibile disegnare l'immagine");
    ctx.drawImage(bg, 0, 0, SHARE_W, SHARE_H);
    const { x, y, w, h, r } = SHARE_CERT;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(cert, x, y, w, h);
    ctx.restore();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossibile creare l'immagine"))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(bgUrl);
    URL.revokeObjectURL(certUrl);
  }
}

/** File PNG pronto per il pannello di condivisione del telefono. */
export async function certificateShareFile(c: CertificateData): Promise<File> {
  return new File([await certificateShareImageBlob(c)], certificateImageFileName(c), { type: 'image/png' });
}

/**
 * Apre il pannello di condivisione del telefono (Instagram, WhatsApp…) con
 * l'immagine; dove non si può (computer) la scarica. Va chiamata subito dopo
 * il tocco: per questo il file si prepara prima (certificateShareFile).
 */
export async function shareCertificateImage(file: File, c: CertificateData): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data: ShareData = {
    files: [file],
    title: `Attestato TECHLAND: ${c.course_title}`,
    text: `Ho completato il corso ${c.course_title} con TECHLAND! ${certificateUrl(c.code)}`,
  };
  if (typeof navigator.canShare === 'function' && navigator.canShare(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Permesso scaduto o condivisione non riuscita: si scarica
    }
  }
  saveBlob(file, file.name);
  return 'downloaded';
}

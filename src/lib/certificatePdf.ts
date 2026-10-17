/**
 * Attestato in PDF, generato nel browser dal modello SVG
 * (src/assets/certificates/attestato.svg). Si carica solo quando serve, con
 * import() dinamico: modello, font e jsPDF non pesano sul resto dell'app.
 *
 * L'SVG riempito diventa un'immagine a 300 dpi su un PDF A4 orizzontale: così
 * il PDF è identico all'anteprima, su tutti i telefoni, con i font del marchio
 * incorporati (un SVG usato come immagine non vede i font della pagina).
 */
import template from '@/assets/certificates/attestato.svg?raw';
import font400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url';
import font600 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2?url';
import font800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2?url';
import { certificateFileName, fillCertificateSvg, type CertificateData } from '@/lib/certificate';

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
export async function certificateSvg(c: CertificateData): Promise<string> {
  const css = await embeddedFonts();
  return fillCertificateSvg(template, c).replace(/<defs>/, `<defs><style>${css}</style>`);
}

/** Anteprima per <img>: stesso disegno del PDF. */
export async function certificatePreviewUrl(c: CertificateData): Promise<string> {
  const svg = await certificateSvg(c);
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

/** PDF dell'attestato (A4 orizzontale). */
export async function certificatePdfBlob(c: CertificateData): Promise<Blob> {
  const [{ jsPDF }, url] = await Promise.all([import('jspdf'), certificatePreviewUrl(c)]);
  try {
    const img = await loadImage(url);
    // Safari a volte disegna un SVG appena caricato senza i font: un attimo di respiro
    await new Promise((r) => setTimeout(r, 50));
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

/** Scarica il PDF con un nome leggibile. */
export async function downloadCertificatePdf(c: CertificateData): Promise<void> {
  const blob = await certificatePdfBlob(c);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = certificateFileName(c);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

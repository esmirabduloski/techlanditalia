import qrcode from 'qrcode-generator';

/** QR code come tracciato SVG: un quadrato di lato 1 per ogni modulo scuro. */
export interface QrPath {
  /** Moduli per lato, senza margine (21 per la versione 1, +4 per ogni versione) */
  size: number;
  /** Attributo d di un <path> in coordinate 0..size */
  d: string;
}

/**
 * Tracciato del QR per `text`, con correzione d'errore M (regge un attestato
 * stampato un po' rovinato). Le righe di moduli consecutivi diventano un solo
 * rettangolo, così il tracciato resta corto.
 */
export function qrPath(text: string): QrPath {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < size && qr.isDark(row, col)) col++;
      parts.push(`M${start} ${row}h${col - start}v1h-${col - start}z`);
    }
  }
  return { size, d: parts.join('') };
}

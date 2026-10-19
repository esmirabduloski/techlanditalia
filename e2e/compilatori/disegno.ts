/**
 * Lettura del disegno della tartaruga (Skulpt): l'immagine visibile dell'area
 * di disegno, 800x600, con lo sfondo e le tele di Skulpt una sopra l'altra.
 * Coordinate come in turtle: (0, 0) al centro, y verso l'alto.
 */
import type { Page } from "@playwright/test";

const W = 800;
const H = 600;

export interface Disegno { pixel: Uint8Array; fondo: number[] }

/** Immagine visibile (RGB, 800x600): sfondo + tele di Skulpt una sopra l'altra. */
export async function leggiDisegno(page: Page): Promise<Disegno> {
  const { base64, fondo } = await page.getByLabel("Area di disegno della tartaruga").evaluate((area) => {
    const W = 800, H = 600;
    const parse = (css: string) => (css.match(/[\d.]+/g) ?? ["255", "255", "255", "0"]).map(Number);
    const sfondo = (el: Element) => {
      const [r, g, b, a = 1] = parse(getComputedStyle(el).backgroundColor);
      return a > 0 ? [r, g, b] : null;
    };
    const base = sfondo(area) ?? [255, 255, 255];
    const tele = [...area.querySelectorAll("canvas")]
      .map((c) => ({ c, z: Number(getComputedStyle(c).zIndex) || 0 }))
      .sort((a, b) => a.z - b.z);
    const img = new Uint8ClampedArray(W * H * 3);
    for (let i = 0; i < W * H; i++) img.set(base, i * 3);
    for (const { c } of tele) {
      const bg = sfondo(c);
      const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      const sx = c.width / W, sy = c.height / H;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        if (bg) img.set(bg, o);
        const i = (Math.floor(y * sy) * c.width + Math.floor(x * sx)) * 4;
        const a = data[i + 3] / 255;
        if (a === 0) continue;
        for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - a) + data[i + k] * a;
      }
    }
    let bin = "";
    for (let i = 0; i < img.length; i += 0x8000) bin += String.fromCharCode(...img.subarray(i, i + 0x8000));
    return { base64: btoa(bin), fondo: [img[0], img[1], img[2]] };
  });
  return { pixel: new Uint8Array(Buffer.from(base64, "base64")), fondo };
}

/** Colore [r, g, b] nel punto (x, y) in coordinate della tartaruga. */
export function colore(disegno: Disegno, x: number, y: number): number[] {
  const px = Math.round(W / 2 + x), py = Math.round(H / 2 - y);
  const o = (py * W + px) * 3;
  return Array.from(disegno.pixel.subarray(o, o + 3));
}

export const vicino = (c: number[], atteso: number[], tolleranza = 60) => c.every((v, k) => Math.abs(v - atteso[k]) <= tolleranza);

/** Pixel diversi dallo sfondo nel rettangolo [x1, y1, x2, y2] (tutta l'area se manca). */
export function pixelDisegnati(disegno: Disegno, zona: [number, number, number, number] = [-W / 2, -H / 2 + 1, W / 2 - 1, H / 2]): number {
  const [x1, y1, x2, y2] = zona;
  let n = 0;
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) if (!vicino(colore(disegno, x, y), disegno.fondo, 10)) n++;
  return n;
}

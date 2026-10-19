/**
 * Aiuti per i test di Pygame Zero nel sito: la finestra del gioco è il canvas
 * #canvas (l'id che vuole SDL), con un pixel per ogni pixel del gioco (WIDTH x HEIGHT).
 */
import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

export const finestra = (page: Page) => page.locator("canvas#canvas");

export function dimensioniGioco(page: Page): Promise<[number, number]> {
  return finestra(page).evaluate((c: HTMLCanvasElement) => [c.width, c.height] as [number, number]);
}

/** Colore [r, g, b] del pixel (x, y) del gioco. */
export function pixelGioco(page: Page, x: number, y: number): Promise<number[]> {
  return finestra(page).evaluate((c: HTMLCanvasElement, [x, y]) => Array.from(c.getContext("2d")!.getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);
}

export const simile = (c: number[], atteso: number[], tolleranza = 30) => c.every((v, k) => Math.abs(v - atteso[k]) <= tolleranza);

/** Aspetta che il gioco abbia questo colore nel punto (x, y). */
export async function aspettaColore(page: Page, x: number, y: number, atteso: number[], timeout = 10_000) {
  await expect.poll(async () => simile(await pixelGioco(page, x, y), atteso), { timeout, message: `colore ${atteso} in (${x}, ${y})` }).toBe(true);
}

/** Pixel diversi dal colore più frequente (lo sfondo): 0 se la finestra è tutta uguale. */
export function pixelDisegnatiGioco(page: Page): Promise<number> {
  return finestra(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    const conta = new Map<number, number>();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      conta.set(k, (conta.get(k) ?? 0) + 1);
    }
    const sfondo = Math.max(...conta.values());
    return d.length / 4 - sfondo;
  });
}

/** PNG pieno di un colore, lato x lato. */
export function pngPieno([r, g, b]: number[], lato = 40): Buffer {
  const riga = Buffer.concat([Buffer.from([0]), Buffer.alloc(lato * 4).fill(Buffer.from([r, g, b, 255]))]);
  const blocco = (tipo: string, dati: Buffer) => {
    const t = Buffer.from(tipo);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(dati.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, dati])));
    return Buffer.concat([len, t, dati, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0);
  ihdr.writeUInt32BE(lato, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco("IHDR", ihdr),
    blocco("IDAT", deflateSync(Buffer.concat(Array(lato).fill(riga)))),
    blocco("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

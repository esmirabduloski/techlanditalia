/**
 * Immagini, suoni, musiche e font dei giochi Pygame Zero nel sito.
 *
 * Arrivano da due posti (gli allegati vincono a parità di nome):
 * - la libreria condivisa public/pgzero-libreria/ (elenco in manifest.json):
 *   si scaricano solo i file il cui nome compare nel codice;
 * - gli allegati del task o del compito: immagini in images/, audio in sounds/ e music/.
 */
import type { FileGioco } from './pgzeroRuntime';

export const LIBRERIA_URL = '/pgzero-libreria';

export type CartellaGioco = 'images' | 'sounds' | 'music' | 'fonts';
export type Libreria = Record<CartellaGioco, string[]>;
export const LIBRERIA_VUOTA: Libreria = { images: [], sounds: [], music: [], fonts: [] };

export interface AllegatoGioco {
  name: string;
  url: string;
  type?: string;
}

export interface FileDaScaricare {
  percorso: string;
  url: string;
}

/** Nome del file come lo cerca pgzero: minuscolo, senza accenti né spazi. */
export function nomeFileGioco(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_');
}

/** Nome da scrivere nel codice: Actor("alien") per alien.png. */
export function nomeNelCodice(nome: string): string {
  return nomeFileGioco(nome).replace(/\.[^.]+$/, '');
}

// Allegati dei task: type "image"/"audio"; dei compiti: il tipo MIME ("image/png")
export function cartelleAllegato(a: AllegatoGioco): CartellaGioco[] {
  const tipo = a.type ?? '';
  if (tipo === 'image' || tipo.startsWith('image/') || /\.(png|gif|jpe?g|bmp)$/i.test(a.name)) return ['images'];
  if (tipo === 'audio' || tipo.startsWith('audio/') || /\.(wav|ogg|oga|mp3)$/i.test(a.name)) return ['sounds', 'music'];
  if (/\.ttf$/i.test(a.name)) return ['fonts'];
  return [];
}

const usatoNelCodice = (codice: string, nome: string) =>
  new RegExp(`(^|[^A-Za-z0-9_])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9_])`).test(codice);

/** File da mettere nella cartella del gioco: quelli della libreria usati nel codice e tutti gli allegati. */
export function fileDaCaricare(codice: string, libreria: Libreria, allegati: AllegatoGioco[]): FileDaScaricare[] {
  const scelti = new Map<string, FileDaScaricare>();
  const chiave = (cartella: string, file: string) => `${cartella}/${nomeNelCodice(file)}`;
  for (const cartella of Object.keys(LIBRERIA_VUOTA) as CartellaGioco[]) {
    for (const file of libreria[cartella] ?? []) {
      if (usatoNelCodice(codice, nomeNelCodice(file))) {
        scelti.set(chiave(cartella, file), { percorso: `${cartella}/${file}`, url: `${LIBRERIA_URL}/${cartella}/${encodeURIComponent(file)}` });
      }
    }
  }
  for (const a of allegati) {
    for (const cartella of cartelleAllegato(a)) {
      scelti.set(chiave(cartella, a.name), { percorso: `${cartella}/${nomeFileGioco(a.name)}`, url: a.url });
    }
  }
  return [...scelti.values()];
}

let libreria: Promise<Libreria> | null = null;

/** Elenco dei file della libreria condivisa (vuoto se manca). */
export function caricaLibreria(): Promise<Libreria> {
  if (!libreria) {
    libreria = fetch(`${LIBRERIA_URL}/manifest.json`)
      .then((r) => (r.ok ? r.json() : LIBRERIA_VUOTA))
      .then((m: Partial<Libreria>) => ({ ...LIBRERIA_VUOTA, ...m }))
      .catch(() => {
        libreria = null;
        return LIBRERIA_VUOTA;
      });
  }
  return libreria;
}

const scaricati = new Map<string, Promise<Uint8Array | null>>();

/** Scarica i file (con cache); quelli che non arrivano mancano e il gioco lo dirà con un errore chiaro. */
export async function scaricaFileGioco(lista: FileDaScaricare[]): Promise<FileGioco[]> {
  const out = await Promise.all(lista.map(async ({ percorso, url }) => {
    let dati = scaricati.get(url);
    if (!dati) {
      dati = fetch(url)
        .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : null))
        .catch(() => null);
      scaricati.set(url, dati);
    }
    const bytes = await dati;
    if (!bytes) {
      scaricati.delete(url);
      console.warn('[pgzero] file non scaricato:', url);
      return null;
    }
    return { percorso, dati: bytes };
  }));
  return out.filter((f): f is FileGioco => f !== null);
}

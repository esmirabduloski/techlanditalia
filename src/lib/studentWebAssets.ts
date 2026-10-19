// File caricati dagli studenti nel compilatore web (immagini, CSS, JS, HTML).
//
// Stanno nel bucket privato student-web-assets, nella cartella "<id utente>/",
// e si aprono solo con link firmati (migrazione 0055). Nel codice lo studente
// li usa per nome, come in un sito vero: <img src="gatto.png">. L'anteprima
// sostituisce il nome con il link firmato del momento.
//
// I file caricati prima stavano nel bucket pubblico web-compiler-assets e nel
// codice c'è il loro URL pubblico completo: l'anteprima sostituisce anche
// quello, e finché l'admin non li sposta continua a usare il vecchio URL.
import { storagePathFrom } from '@/lib/storagePaths';

export const STUDENT_WEB_ASSETS_BUCKET = 'student-web-assets';
export const LEGACY_WEB_ASSETS_BUCKET = 'web-compiler-assets';

/** Validità dei link firmati usati dall'anteprima, e ogni quanto rinnovarli. */
export const SIGNED_URL_SECONDS = 60 * 60;
export const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000;

export type WebFileType = 'image' | 'css' | 'js' | 'html';

export interface StudentWebFile {
  /** Nome da usare nel codice (file nuovi) o nome originale (file vecchi) */
  name: string;
  type: WebFileType;
  /** Percorso nel bucket privato: "<id utente>/gatto-1729-ab12c.png" */
  path?: string;
  /** Solo file vecchi: URL pubblico in web-compiler-assets */
  url?: string;
}

const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Cosa scrive lo studente nel codice per usare il file. */
export function codeReference(file: StudentWebFile): string {
  return file.path ? file.name : file.url ?? file.name;
}

/** Chiave stabile del file (per rimuoverlo dall'elenco). */
export function fileKey(file: StudentWebFile): string {
  return file.path ?? file.url ?? file.name;
}

/** Percorso del file nel bucket privato (i file vecchi tengono lo stesso percorso). */
export function storagePathOf(file: StudentWebFile): string | null {
  if (file.path) return file.path;
  if (!file.url) return null;
  const path = storagePathFrom(LEGACY_WEB_ASSETS_BUCKET, file.url);
  return path && UUID_FOLDER.test(path.split('/')[0]) ? path : null;
}

/**
 * Nome con cui il file si usa nel codice: niente spazi né caratteri speciali
 * (come nel percorso salvato), e unico tra i file già caricati per la task.
 */
export function referenceName(originalName: string, taken: string[]): string {
  const dot = originalName.lastIndexOf('.');
  const ext = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : '';
  const base = (dot > 0 ? originalName.slice(0, dot) : originalName).replace(/[^a-zA-Z0-9-_]/g, '-') || 'file';
  const withExt = (b: string) => (ext ? `${b}.${ext}` : b);
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let candidate = withExt(base);
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = withExt(`${base}-${n}`);
  return candidate;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sostituisce nel codice i riferimenti ai file (nome o vecchio URL) con il
 * link da usare adesso. Vale solo dove il riferimento è un valore intero:
 * src="gatto.png", src=gatto.png, url(./gatto.png), 'gatto.png' in JS.
 * "img/gatto.png" o "gattone.png" restano come sono.
 */
export function resolveAssetRefs(code: string, assets: Record<string, string>): string {
  const refs = Object.keys(assets).sort((a, b) => b.length - a.length);
  if (refs.length === 0) return code;
  const re = new RegExp(`(^|["'\`(=\\s])(?:\\./)?(${refs.map(escapeRegExp).join('|')})(?=$|["'\`)\\s>?#])`, 'g');
  return code.replace(re, (_match, before: string, ref: string) => before + assets[ref]);
}

// Solo le parti del client Supabase usate qui (così i test usano un finto client)
interface SignedUrlsResult {
  data: { path: string | null; signedUrl: string | null; error: string | null }[] | null;
  error: unknown;
}
interface ListedObject {
  name: string;
  id: string | null;
}
interface BucketApi {
  createSignedUrls(paths: string[], expiresIn: number): Promise<SignedUrlsResult>;
  list(prefix?: string, options?: { limit?: number; offset?: number }): Promise<{ data: ListedObject[] | null; error: unknown }>;
  move(from: string, to: string, options?: { destinationBucket?: string }): Promise<{ error: unknown }>;
}
export interface StorageClient {
  storage: { from(bucket: string): BucketApi };
}

/**
 * Link da usare nell'anteprima per ogni riferimento ai file dello studente.
 * Un file vecchio non ancora spostato nel bucket privato usa il suo URL pubblico.
 */
export async function resolveStudentWebAssets(
  client: StorageClient,
  files: StudentWebFile[],
  expiresIn = SIGNED_URL_SECONDS,
): Promise<Record<string, string>> {
  const paths = [...new Set(files.map(storagePathOf).filter((p): p is string => !!p))];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await client.storage.from(STUDENT_WEB_ASSETS_BUCKET).createSignedUrls(paths, expiresIn);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
    }
  }

  const result: Record<string, string> = {};
  for (const file of files) {
    const path = storagePathOf(file);
    const url = (path && signed.get(path)) || file.url;
    if (url) result[codeReference(file)] = url;
  }
  return result;
}

const PAGE = 1000;

async function listAll(client: StorageClient, bucket: string, prefix: string): Promise<ListedObject[]> {
  const all: ListedObject[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

/**
 * File degli utenti rimasti nel bucket pubblico (cartelle "<id utente>/").
 * I materiali dei docenti (task-attachments/, editor-uploads/) restano dove sono.
 * Serve la sessione di un admin: solo l'admin può elencare quel bucket.
 */
export async function listLegacyStudentWebAssets(client: StorageClient): Promise<string[]> {
  const root = await listAll(client, LEGACY_WEB_ASSETS_BUCKET, '');
  const folders = root.filter((o) => o.id === null && UUID_FOLDER.test(o.name)).map((o) => o.name);
  const paths: string[] = [];
  for (const folder of folders) {
    const files = await listAll(client, LEGACY_WEB_ASSETS_BUCKET, folder);
    for (const f of files) if (f.id !== null) paths.push(`${folder}/${f.name}`);
  }
  return paths;
}

/** Sposta i file nel bucket privato, stesso percorso. Si può ripetere: riprende da dove era rimasto. */
export async function moveLegacyStudentWebAssets(
  client: StorageClient,
  paths: string[],
  onProgress?: (done: number) => void,
): Promise<{ moved: number; failed: string[] }> {
  let moved = 0;
  const failed: string[] = [];
  for (const [i, path] of paths.entries()) {
    const { error } = await client.storage
      .from(LEGACY_WEB_ASSETS_BUCKET)
      .move(path, path, { destinationBucket: STUDENT_WEB_ASSETS_BUCKET });
    if (error) failed.push(path);
    else moved++;
    onProgress?.(i + 1);
  }
  return { moved, failed };
}

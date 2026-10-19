import { describe, expect, it } from 'vitest';
import {
  codeReference,
  listLegacyStudentWebAssets,
  moveLegacyStudentWebAssets,
  referenceName,
  resolveAssetRefs,
  resolveStudentWebAssets,
  storagePathOf,
  type StorageClient,
  type StudentWebFile,
} from './studentWebAssets';

const UID = '11111111-1111-4111-8111-111111111111';
const LEGACY_URL = `https://p.supabase.co/storage/v1/object/public/web-compiler-assets/${UID}/gatto-17-ab.png`;

const nuovo: StudentWebFile = { name: 'gatto.png', type: 'image', path: `${UID}/gatto-1729-xy.png` };
const vecchio: StudentWebFile = { name: 'Foto gatto.png', type: 'image', url: LEGACY_URL };

describe('riferimenti nel codice', () => {
  it('file nuovo: si usa per nome; file vecchio: con il suo URL', () => {
    expect(codeReference(nuovo)).toBe('gatto.png');
    expect(codeReference(vecchio)).toBe(LEGACY_URL);
  });

  it('percorso nel bucket privato, anche per i file vecchi', () => {
    expect(storagePathOf(nuovo)).toBe(`${UID}/gatto-1729-xy.png`);
    expect(storagePathOf(vecchio)).toBe(`${UID}/gatto-17-ab.png`);
    // URL esterni o materiali dei docenti: niente da firmare
    expect(storagePathOf({ name: 'x', type: 'image', url: 'https://example.com/x.png' })).toBeNull();
    expect(
      storagePathOf({ name: 'x', type: 'image', url: 'https://p.supabase.co/storage/v1/object/public/web-compiler-assets/task-attachments/x.png' }),
    ).toBeNull();
  });

  it('nome senza spazi né caratteri speciali e unico per la task', () => {
    expect(referenceName('Foto Mare!.PNG', [])).toBe('Foto-Mare-.png');
    expect(referenceName('gatto.png', ['gatto.png'])).toBe('gatto-2.png');
    expect(referenceName('gatto.png', ['Gatto.png', 'gatto-2.png'])).toBe('gatto-3.png');
    expect(referenceName('README', [])).toBe('README');
  });
});

describe('resolveAssetRefs', () => {
  const assets = { 'gatto.png': 'https://firmato/gatto?token=1', [LEGACY_URL]: 'https://firmato/vecchio?token=2' };

  it('sostituisce i riferimenti usati come valore in HTML, CSS e JS', () => {
    expect(resolveAssetRefs('<img src="gatto.png"><img src=gatto.png>', assets)).toBe(
      '<img src="https://firmato/gatto?token=1"><img src=https://firmato/gatto?token=1>',
    );
    expect(resolveAssetRefs("body { background: url(./gatto.png) } a { b: url('gatto.png') }", assets)).toBe(
      "body { background: url(https://firmato/gatto?token=1) } a { b: url('https://firmato/gatto?token=1') }",
    );
    expect(resolveAssetRefs('img.src = `gatto.png`;', assets)).toBe('img.src = `https://firmato/gatto?token=1`;');
    expect(resolveAssetRefs(`<img src="${LEGACY_URL}">`, assets)).toBe('<img src="https://firmato/vecchio?token=2">');
  });

  it('lascia stare percorsi diversi, nomi più lunghi e il testo', () => {
    const code = '<img src="img/gatto.png"><img src="grande-gatto.png"><p>gattoXpng</p>';
    expect(resolveAssetRefs(code, assets)).toBe(code);
  });

  it('non tocca il link già inserito (una sola passata)', () => {
    expect(resolveAssetRefs('"a.png"', { 'a.png': 'https://x/"b.png"', 'b.png': 'NO' })).toBe('"https://x/"b.png""');
  });
});

function fakeClient(objects: Record<string, string[]>, opts: { signFails?: string[]; moveFails?: string[] } = {}) {
  const calls = { signed: [] as string[][], moved: [] as { from: string; to: string; bucket?: string }[], listed: [] as string[] };
  const client: StorageClient = {
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[]) => {
          calls.signed.push(paths);
          return {
            data: paths.map((p) =>
              opts.signFails?.includes(p)
                ? { path: p, signedUrl: null, error: 'Object not found' }
                : { path: p, signedUrl: `https://firmato/${bucket}/${p}`, error: null },
            ),
            error: null,
          };
        },
        list: async (prefix = '', options = {}) => {
          calls.listed.push(`${bucket}:${prefix}:${options.offset ?? 0}`);
          const names = objects[prefix] ?? [];
          const page = names.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 100));
          // Le cartelle tornano con id null
          return { data: page.map((n) => (n.endsWith('/') ? { name: n.slice(0, -1), id: null } : { name: n, id: `id-${n}` })), error: null };
        },
        move: async (from: string, to: string, options?: { destinationBucket?: string }) => {
          calls.moved.push({ from, to, bucket: options?.destinationBucket });
          return { error: opts.moveFails?.includes(from) ? new Error('boom') : null };
        },
      }),
    },
  };
  return { client, calls };
}

describe('resolveStudentWebAssets', () => {
  it('firma nel bucket privato; un file vecchio non ancora spostato usa il suo URL', async () => {
    const { client, calls } = fakeClient({}, { signFails: [`${UID}/gatto-17-ab.png`] });
    const urls = await resolveStudentWebAssets(client, [nuovo, vecchio]);
    expect(calls.signed).toEqual([[`${UID}/gatto-1729-xy.png`, `${UID}/gatto-17-ab.png`]]);
    expect(urls).toEqual({
      'gatto.png': `https://firmato/student-web-assets/${UID}/gatto-1729-xy.png`,
      [LEGACY_URL]: LEGACY_URL,
    });
  });

  it('file vecchio già spostato: link firmato al posto dell\'URL pubblico', async () => {
    const { client } = fakeClient({});
    expect(await resolveStudentWebAssets(client, [vecchio])).toEqual({
      [LEGACY_URL]: `https://firmato/student-web-assets/${UID}/gatto-17-ab.png`,
    });
  });

  it('nessun file: nessuna richiesta', async () => {
    const { client, calls } = fakeClient({});
    expect(await resolveStudentWebAssets(client, [])).toEqual({});
    expect(calls.signed).toEqual([]);
  });
});

describe('spostamento dei file vecchi', () => {
  const UID2 = '22222222-2222-4222-8222-222222222222';

  it('trova solo le cartelle degli utenti, non i materiali dei docenti', async () => {
    const { client } = fakeClient({
      '': [`${UID}/`, `${UID2}/`, 'task-attachments/', 'editor-uploads/', 'sciolto.png'],
      [UID]: ['a.png', 'b.css'],
      [UID2]: ['c.png', 'sotto/'],
    });
    expect(await listLegacyStudentWebAssets(client)).toEqual([`${UID}/a.png`, `${UID}/b.css`, `${UID2}/c.png`]);
  });

  it('legge tutte le pagine dell\'elenco', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => `f${i}.png`);
    const { client, calls } = fakeClient({ '': [`${UID}/`], [UID]: many });
    expect(await listLegacyStudentWebAssets(client)).toHaveLength(1001);
    expect(calls.listed).toEqual(['web-compiler-assets::0', `web-compiler-assets:${UID}:0`, `web-compiler-assets:${UID}:1000`]);
  });

  it('sposta nel bucket privato con lo stesso percorso e segnala gli errori', async () => {
    const { client, calls } = fakeClient({}, { moveFails: [`${UID}/b.css`] });
    const progress: number[] = [];
    const result = await moveLegacyStudentWebAssets(client, [`${UID}/a.png`, `${UID}/b.css`], (d) => progress.push(d));
    expect(result).toEqual({ moved: 1, failed: [`${UID}/b.css`] });
    expect(calls.moved).toEqual([
      { from: `${UID}/a.png`, to: `${UID}/a.png`, bucket: 'student-web-assets' },
      { from: `${UID}/b.css`, to: `${UID}/b.css`, bucket: 'student-web-assets' },
    ]);
    expect(progress).toEqual([1, 2]);
  });
});

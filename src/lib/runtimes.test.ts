import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGZERO_WHEEL_URL, PYGAME_PYODIDE_INDEX_URL, PYGAME_PYODIDE_VERSION, PYODIDE_INDEX_URL, PYODIDE_VERSION, SKULPT_URLS, SKULPT_VERSION } from './runtimes';

const root = path.resolve(__dirname, '../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

describe('versioni dei runtime', () => {
  it('gli URL usano le versioni dichiarate', () => {
    expect(PYODIDE_INDEX_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`);
    for (const url of SKULPT_URLS) expect(url).toContain(`/skulpt@${SKULPT_VERSION}/`);
    expect(PYGAME_PYODIDE_INDEX_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${PYGAME_PYODIDE_VERSION}/full/`);
  });

  it('il pacchetto pgzero servito dal sito esiste in public/', () => {
    expect(existsSync(path.join(root, 'public', PGZERO_WHEEL_URL))).toBe(true);
  });

  it('il ripiego del worker dei casi di prova è la stessa versione di Pyodide', () => {
    const worker = readFileSync(path.join(root, 'public/pyodide-test-worker.js'), 'utf8');
    expect(worker).toContain(`const FALLBACK_PYODIDE_VERSION = '${PYODIDE_VERSION}';`);
  });

  it('nessun altro file scrive a mano un URL di Pyodide o Skulpt', () => {
    const hardcoded = [...files(path.join(root, 'src')), ...files(path.join(root, 'public'))]
      .filter((f) => /\.(tsx?|jsx?|html)$/.test(f) && !f.endsWith(path.join('lib', 'runtimes.ts')) && !f.endsWith('.test.ts'))
      .filter((f) => /cdn\.jsdelivr\.net\/(pyodide\/v\d|npm\/skulpt@)/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f));
    expect(hardcoded).toEqual([]);
  });
});

/**
 * Versioni dei runtime dei compilatori, scaricati da jsDelivr.
 * Unico punto da cambiare: le usano PythonCompiler, TurtleCompiler, il worker
 * dei casi di prova (public/pyodide-test-worker.js, via ?v=) e i test e2e.
 *
 * Per aggiornare Pyodide o Skulpt:
 *   1. cambia la versione qui (e la costante di ripiego nel worker)
 *   2. npm run test:compilatori
 *   3. le differenze negli snapshot dei task veri (e2e/compilatori/__snapshots__)
 *      mostrano cosa cambierebbe per gli alunni: accetta solo quelle volute
 *      (--update-snapshots), le altre sono task che l'aggiornamento rompe.
 */

export const PYODIDE_VERSION = '0.24.1';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Pygame Zero: un Pyodide più recente, con pygame-ce (la 0.24.1 non lo ha), separato da
// quello di Python così i task Python non cambiano. pgzero (Python puro, LGPL) è servito
// dal sito: public/pyodide/.
export const PYGAME_PYODIDE_VERSION = '0.27.7';
export const PYGAME_PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYGAME_PYODIDE_VERSION}/full/`;
export const PGZERO_WHEEL_URL = '/pyodide/pgzero-1.2.1-py3-none-any.whl';

export const SKULPT_VERSION = '1.2.0';
export const SKULPT_URLS = [
  `https://cdn.jsdelivr.net/npm/skulpt@${SKULPT_VERSION}/dist/skulpt.min.js`,
  `https://cdn.jsdelivr.net/npm/skulpt@${SKULPT_VERSION}/dist/skulpt-stdlib.js`,
] as const;

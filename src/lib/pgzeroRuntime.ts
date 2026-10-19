/**
 * Pygame Zero nel sito: un Pyodide a parte (con pygame-ce) che disegna il gioco
 * in un <canvas> della pagina. Il ciclo di gioco è in pgzeroRunner.py.
 *
 * C'è una sola finestra di gioco per pagina: SDL resta legato al canvas su cui
 * parte, quindi lo stesso elemento viene spostato nel compilatore che lo mostra.
 */
import RUNNER from './pgzeroRunner.py?raw';
import { PGZERO_WHEEL_URL, PYGAME_PYODIDE_INDEX_URL } from './runtimes';

interface PyodideGioco {
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: Uint8Array): void };
  canvas: { setCanvas2D(canvas: HTMLCanvasElement): void };
  globals: { set(name: string, value: unknown): void };
  loadPackage(names: string[]): Promise<unknown>;
  runPython(code: string, options?: { filename?: string }): unknown;
  runPythonAsync(code: string, options?: { filename?: string }): Promise<unknown>;
  setStdout(options: { batched: (riga: string) => void }): void;
  setStderr(options: { batched: (riga: string) => void }): void;
}

export const CARTELLA_GIOCO = '/home/pyodide/gioco';

/** File del gioco, con il percorso nella cartella: "images/alien.png", "sounds/salto.wav"... */
export interface FileGioco {
  percorso: string;
  dati: Uint8Array;
}

let finestra: HTMLCanvasElement | null = null;

/** La finestra del gioco (una per pagina). */
export function finestraPgzero(): HTMLCanvasElement {
  if (!finestra) {
    finestra = document.createElement('canvas');
    // SDL (pygame) vuole il canvas con id "canvas"; serve anche a mandare la tastiera
    // solo a questa finestra (pgzeroRunner.py)
    finestra.id = 'canvas';
    finestra.tabIndex = 0;
    // Le frecce comandano il gioco, non la navigazione tra i task (useLessonKeyboardNav)
    finestra.dataset.capturesKeys = 'true';
    finestra.setAttribute('aria-label', 'Finestra del gioco');
    finestra.width = 800;
    finestra.height = 600;
  }
  return finestra;
}

let pronto: Promise<PyodideGioco> | null = null;
let scriviOutput: ((testo: string) => void) | null = null;

/** Scarica Pyodide, pygame e pgzero (la prima volta ~15 MB, poi dalla cache del browser). */
export function caricaPgzero(): Promise<PyodideGioco> {
  if (!pronto) {
    pronto = (async () => {
      // Il Pyodide di Python (0.24.1, PythonCompiler) vive in variabili globali che ogni
      // versione riusa se le trova: questo Pyodide carica le sue senza toccarle.
      const g = globalThis as unknown as Record<string, unknown>;
      const globaliPython = { loadPyodide: g.loadPyodide, _createPyodideModule: g._createPyodideModule };
      delete g._createPyodideModule;
      let py: PyodideGioco;
      try {
        const modulo = await import(/* @vite-ignore */ `${PYGAME_PYODIDE_INDEX_URL}pyodide.mjs`);
        py = await modulo.loadPyodide({ indexURL: PYGAME_PYODIDE_INDEX_URL });
      } finally {
        for (const [nome, valore] of Object.entries(globaliPython)) {
          if (valore === undefined) delete g[nome];
          else g[nome] = valore;
        }
      }
      py.canvas.setCanvas2D(finestraPgzero());
      await py.loadPackage(['pygame-ce', new URL(PGZERO_WHEEL_URL, window.location.origin).href]);
      py.setStdout({ batched: (riga) => scriviOutput?.(`${riga}\n`) });
      py.setStderr({ batched: (riga) => console.warn('[pgzero]', riga) });
      py.runPython('import sys, types\nsys.modules["techland_pgzero"] = types.ModuleType("techland_pgzero")');
      py.globals.set('_tl_src', RUNNER);
      py.runPython('exec(compile(_tl_src, "<techland>", "exec"), sys.modules["techland_pgzero"].__dict__)', { filename: '<techland>' });
      return py;
    })().catch((e) => {
      pronto = null;
      throw e;
    });
  }
  return pronto;
}

let inCorso: Promise<unknown> | null = null;

/**
 * Esegue un gioco: si risolve quando il gioco finisce (Stop, exit()) e si rifiuta
 * con il traceback Python se il codice dà errore. Un gioco già in corso viene fermato.
 */
export async function eseguiPgzero(
  codice: string,
  file: FileGioco[],
  { onOutput, onDimensioni }: { onOutput: (testo: string) => void; onDimensioni: (w: number, h: number) => void },
): Promise<void> {
  const py = await caricaPgzero();
  if (inCorso) {
    fermaPgzero();
    await inCorso.catch(() => {});
  }

  py.runPython('import techland_pgzero\ntechland_pgzero.prepara_cartella()', { filename: '<techland>' });
  for (const f of file) {
    const percorso = `${CARTELLA_GIOCO}/${f.percorso}`;
    py.FS.mkdirTree(percorso.slice(0, percorso.lastIndexOf('/')));
    py.FS.writeFile(percorso, f.dati);
  }

  scriviOutput = onOutput;
  py.globals.set('_tl_codice', codice);
  py.globals.set('_tl_dimensioni', onDimensioni);
  const corsa = py.runPythonAsync('await techland_pgzero.esegui(_tl_codice, _tl_dimensioni)', { filename: '<techland>' });
  inCorso = corsa;
  try {
    await corsa;
  } finally {
    if (inCorso === corsa) inCorso = null;
  }
}

/** Ferma il gioco in corso (al frame successivo). */
export function fermaPgzero() {
  void pronto?.then((py) => py.runPython('import techland_pgzero\ntechland_pgzero.ferma()', { filename: '<techland>' }));
}

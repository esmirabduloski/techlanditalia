// Worker dei casi di prova Python (correzione automatica).
// Gira fuori dal thread della pagina: un ciclo infinito non blocca l'app,
// il thread principale chiama worker.terminate() allo scadere del tempo.
// Protocollo:
//   -> { type: 'init' }                         <- { type: 'ready' } | { type: 'fatal', error }
//   -> { type: 'run', runId, code, test }       <- { type: 'started', runId } poi { type: 'result', runId, result }
/* eslint-disable no-undef */
// Versione da src/lib/runtimes.ts (?v=); il ripiego serve solo a una pagina vecchia
// ancora in cache che apre il worker senza parametro. Tienilo uguale a PYODIDE_VERSION.
const FALLBACK_PYODIDE_VERSION = '0.24.1';
const REQUESTED_VERSION = new URL(self.location.href).searchParams.get('v');
const PYODIDE_VERSION = /^\d+\.\d+\.\d+$/.test(REQUESTED_VERSION || '') ? REQUESTED_VERSION : FALLBACK_PYODIDE_VERSION;
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

// Codice di servizio, compilato come "<techland>": negli errori l'ultima riga "<exec>"
// del traceback resta quella dell'alunno, anche se l'errore nasce qui (es. input() finiti).
const PRELUDE = `
import sys, builtins
from io import StringIO

class _TLStdin(StringIO):
    pass

def _tl_prepare(stdin_text):
    sys.stdout = StringIO()
    sys.stderr = StringIO()
    sys.stdin = _TLStdin(stdin_text or "")

    # Il messaggio di input() non finisce nell'output: si confrontano solo i print()
    def _tl_input(prompt=""):
        line = sys.stdin.readline()
        if line == "":
            raise EOFError("Il programma chiede più input di quelli previsti dal test")
        return line.rstrip("\\n")

    builtins.input = _tl_input
    return {"__name__": "__main__"}

def _tl_output():
    return sys.stdout.getvalue()
`;

let pyodideReady = null;

function loadRuntime() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      importScripts(PYODIDE_URL + 'pyodide.js');
      const pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
      pyodide.globals.set('_tl_src', PRELUDE);
      pyodide.runPython('exec(compile(_tl_src, "<techland>", "exec"))');
      return pyodide;
    })();
  }
  return pyodideReady;
}

// Ultima riga del traceback ("NameError: name 'x' is not defined"), con la riga del codice se c'è
// withLine = false per gli errori del codice del test: la riga non è quella dello studente
function shortError(err, withLine = true) {
  const msg = String((err && err.message) || err || 'Errore');
  const lines = msg.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const last = lines[lines.length - 1] || msg;
  let lineInfo = '';
  for (let i = withLine ? lines.length - 1 : -1; i >= 0; i--) {
    const m = lines[i].match(/File "<exec>", line (\d+)/);
    if (m) { lineInfo = ` (riga ${m[1]})`; break; }
  }
  return last + lineInfo;
}

function isSystemExit(err) {
  return /SystemExit/.test(String((err && err.message) || ''));
}

async function runTest(pyodide, code, test) {
  // Un namespace nuovo per ogni test: le variabili di un test non passano al successivo
  const globals = pyodide.globals.get('_tl_prepare')(test.stdin || '');

  try {
    try {
      await pyodide.runPythonAsync(code, { globals });
    } catch (err) {
      if (!isSystemExit(err)) {
        return { id: test.id, passed: false, actual: pyodide.globals.get('_tl_output')(), error: shortError(err) };
      }
    }

    if (test.kind === 'io') {
      return { id: test.id, passed: null, actual: pyodide.globals.get('_tl_output')() };
    }

    // assert: gira dopo il codice dello studente, con le sue funzioni e variabili
    try {
      await pyodide.runPythonAsync(test.code, { globals });
      return { id: test.id, passed: true };
    } catch (err) {
      const error = /AssertionError\s*$/.test(String(err && err.message).trim())
        ? 'Il risultato non è quello atteso'
        : shortError(err, false);
      return { id: test.id, passed: false, error };
    }
  } finally {
    globals.destroy();
  }
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type === 'init') {
    try {
      await loadRuntime();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'fatal', error: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.type === 'run') {
    const { runId, code, test } = msg;
    try {
      const pyodide = await loadRuntime();
      // I pacchetti (es. numpy) si scaricano prima che parta il tempo del test
      try { await pyodide.loadPackagesFromImports(code); } catch (_) { /* l'errore vero arriva all'esecuzione */ }
      self.postMessage({ type: 'started', runId });
      const result = await runTest(pyodide, code, test);
      self.postMessage({ type: 'result', runId, result });
    } catch (err) {
      self.postMessage({ type: 'result', runId, result: { id: test.id, passed: false, error: shortError(err) } });
    }
  }
};

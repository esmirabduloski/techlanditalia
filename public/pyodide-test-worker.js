// Worker dei casi di prova Python (correzione automatica).
// Gira fuori dal thread della pagina: un ciclo infinito non blocca l'app,
// il thread principale chiama worker.terminate() allo scadere del tempo.
// Protocollo:
//   -> { type: 'init' }                         <- { type: 'ready' } | { type: 'fatal', error }
//   -> { type: 'run', runId, code, test }       <- { type: 'started', runId } poi { type: 'result', runId, result }
/* eslint-disable no-undef */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

let pyodideReady = null;

function loadRuntime() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      importScripts(PYODIDE_URL + 'pyodide.js');
      const pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
      pyodide.runPython(`
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
`);
      return pyodide;
    })();
  }
  return pyodideReady;
}

// Ultima riga del traceback ("NameError: name 'x' is not defined"), con la riga del codice se c'è
function shortError(err) {
  const msg = String((err && err.message) || err || 'Errore');
  const lines = msg.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const last = lines[lines.length - 1] || msg;
  let lineInfo = '';
  for (let i = lines.length - 1; i >= 0; i--) {
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
        : shortError(err);
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

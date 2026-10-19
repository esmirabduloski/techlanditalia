// Esegue i casi di prova Python nel worker public/pyodide-test-worker.js.
// Un worker solo, riusato tra le esecuzioni; se un test supera il tempo
// massimo il worker viene terminato e ricreato al test successivo.
import { compareOutput, TEST_TIMEOUT_MS, TIMEOUT_ERROR, type PythonTestCase, type TestResult } from './testCases';
import { PYODIDE_VERSION } from './runtimes';

const INIT_TIMEOUT_MS = 90_000;
// ?v= dice al worker quale Pyodide caricare (e cambia la cache a ogni aggiornamento)
const WORKER_URL = `/pyodide-test-worker.js?v=${PYODIDE_VERSION}`;

interface WorkerResult { id: string; passed: boolean | null; actual?: string; error?: string }

let worker: Worker | null = null;
let workerReady: Promise<Worker> | null = null;
let runCounter = 0;

function resetWorker() {
  worker?.terminate();
  worker = null;
  workerReady = null;
}

function getWorker(): Promise<Worker> {
  if (workerReady) return workerReady;
  workerReady = new Promise<Worker>((resolve, reject) => {
    const w = new Worker(WORKER_URL);
    worker = w;
    const timer = setTimeout(() => {
      cleanup();
      resetWorker();
      reject(new Error('Python non si è caricato in tempo. Controlla la connessione e riprova.'));
    }, INIT_TIMEOUT_MS);
    const cleanup = () => { clearTimeout(timer); w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ready') { cleanup(); resolve(w); }
      else if (e.data?.type === 'fatal') { cleanup(); resetWorker(); reject(new Error('Impossibile caricare Python. Ricarica la pagina.')); }
    };
    const onError = () => { cleanup(); resetWorker(); reject(new Error('Impossibile avviare Python. Ricarica la pagina.')); };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ type: 'init' });
  });
  return workerReady;
}

function runOne(w: Worker, code: string, test: PythonTestCase): Promise<TestResult> {
  const runId = ++runCounter;
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: TestResult, kill = false) => {
      if (timer) clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (kill) resetWorker();
      resolve(result);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.runId !== runId) return;
      if (data.type === 'started') {
        // Il tempo parte solo dopo il caricamento di Python e dei pacchetti
        timer = setTimeout(() => finish({ id: test.id, passed: false, error: TIMEOUT_ERROR }, true), TEST_TIMEOUT_MS);
      } else if (data.type === 'result') {
        finish(toTestResult(test, data.result as WorkerResult));
      }
    };
    const onError = () => finish({ id: test.id, passed: false, error: 'Python si è interrotto. Riprova.' }, true);
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ type: 'run', runId, code, test });
  });
}

export function toTestResult(test: PythonTestCase, r: WorkerResult): TestResult {
  const out: TestResult = { id: test.id, passed: false };
  if (r.actual != null) out.actual = r.actual.slice(0, 2000);
  if (r.error) out.error = r.error;
  if (test.kind === 'io' && r.passed === null) {
    out.passed = compareOutput(r.actual ?? '', test.expected, test.match);
  } else {
    out.passed = r.passed === true;
  }
  return out;
}

// Precarica Python in background (es. quando si apre una task con test)
export function preloadPythonTests(): void {
  getWorker().catch(() => { /* l'errore viene mostrato alla prima verifica */ });
}

export async function runPythonTests(
  code: string,
  cases: PythonTestCase[],
  onResult?: (result: TestResult) => void,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const test of cases) {
    // Dopo un timeout il worker è stato terminato: getWorker ne crea uno nuovo
    const w = await getWorker();
    const result = await runOne(w, code, test);
    results.push(result);
    onResult?.(result);
  }
  return results;
}

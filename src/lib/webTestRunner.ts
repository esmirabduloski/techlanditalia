// Esegue i casi di prova Web in un iframe nascosto con l'anteprima dello studente.
// L'iframe è sandbox "allow-scripts" senza allow-same-origin: il codice dello
// studente non può toccare l'app; i risultati tornano con postMessage.
import { buildPreviewHtml, type WebPreviewInput } from './webPreview';
import { TEST_TIMEOUT_MS, TIMEOUT_ERROR, type TestResult, type WebTestCase } from './testCases';

// Gira dentro l'iframe: niente import, solo la funzione serializzata.
function harness(cases: WebTestCase[], nonce: string) {
  const errors: string[] = [];
  window.addEventListener('error', (e) => { errors.push(String(e.message)); });

  const clip = (s: string) => (s.length > 200 ? `${s.slice(0, 200)}…` : s);
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  // Valore atteso calcolato dal browser, così "red" equivale a "rgb(255, 0, 0)"
  const computedExpected = (property: string, value: string) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property, value);
    if (!probe.style.getPropertyValue(property)) return value;
    probe.style.display = property === 'display' ? value : 'block';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return v || value;
  };

  const runOne = async (c: WebTestCase) => {
    try {
      switch (c.kind) {
        case 'dom-exists': {
          const el = document.querySelector(c.selector);
          return { id: c.id, passed: !!el, actual: el ? undefined : 'Elemento non trovato' };
        }
        case 'dom-text': {
          const el = document.querySelector(c.selector) as HTMLElement | null;
          if (!el) return { id: c.id, passed: false, actual: 'Elemento non trovato' };
          const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
          const passed = text.toLowerCase().includes(c.contains.replace(/\s+/g, ' ').trim().toLowerCase());
          return { id: c.id, passed, actual: clip(text) };
        }
        case 'dom-count': {
          const n = document.querySelectorAll(c.selector).length;
          const passed = n >= c.min && (c.max == null || n <= c.max);
          return { id: c.id, passed, actual: `${n} elementi` };
        }
        case 'css': {
          const el = document.querySelector(c.selector);
          if (!el) return { id: c.id, passed: false, actual: 'Elemento non trovato' };
          const actual = getComputedStyle(el).getPropertyValue(c.property);
          const passed = norm(actual) === norm(c.value) || norm(actual) === norm(computedExpected(c.property, c.value));
          return { id: c.id, passed, actual: actual || '(nessun valore)' };
        }
        case 'js': {
          const value = await (0, eval)(`(async () => (${c.expression}))()`);
          return { id: c.id, passed: !!value, actual: clip(String(value)) };
        }
      }
    } catch (e) {
      return { id: (c as WebTestCase).id, passed: false, error: clip(String((e as Error)?.message || e)) };
    }
  };

  const run = async () => {
    const results = [];
    for (const c of cases) results.push(await runOne(c));
    parent.postMessage({ source: 'techland-web-tests', nonce, results, errors: errors.slice(0, 3) }, '*');
  };

  // Lascia girare il JS dello studente (anche i setTimeout brevi) prima di verificare
  const start = () => setTimeout(run, 150);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
}

// JSON dentro <script>: niente "</script>" che chiuderebbe il tag
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function buildTestDocument(preview: WebPreviewInput, cases: WebTestCase[], nonce: string): string {
  const tailScript = `(${harness.toString()})(${safeJson(cases)}, ${safeJson(nonce)});`;
  return buildPreviewHtml({ ...preview, tailScript });
}

export interface WebTestRun {
  results: TestResult[];
  // Errori JavaScript della pagina dello studente, utili come spiegazione
  pageErrors: string[];
}

export function runWebTests(preview: WebPreviewInput, cases: WebTestCase[]): Promise<WebTestRun> {
  if (cases.length === 0) return Promise.resolve({ results: [], pageErrors: [] });
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    // Fuori schermo ma con dimensioni reali, così layout e stili calcolati sono veri
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;visibility:hidden;';

    let done = false;
    const finish = (run: WebTestRun) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      iframe.remove();
      resolve(run);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'techland-web-tests' || data.nonce !== nonce) return;
      const byId = new Map<string, TestResult>(
        (Array.isArray(data.results) ? data.results : []).map((r: TestResult) => [r.id, r]),
      );
      finish({
        results: cases.map((c) => {
          const r = byId.get(c.id);
          return r ? { id: c.id, passed: r.passed === true, actual: r.actual, error: r.error } : { id: c.id, passed: false, error: 'Nessun risultato' };
        }),
        pageErrors: Array.isArray(data.errors) ? data.errors.map(String) : [],
      });
    };

    const timer = setTimeout(() => {
      finish({ results: cases.map((c) => ({ id: c.id, passed: false, error: TIMEOUT_ERROR })), pageErrors: [] });
    }, TEST_TIMEOUT_MS);

    window.addEventListener('message', onMessage);
    iframe.srcdoc = buildTestDocument(preview, cases, nonce);
    document.body.appendChild(iframe);
  });
}

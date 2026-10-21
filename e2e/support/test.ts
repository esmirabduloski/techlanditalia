/**
 * `test` con un Supabase finto già installato sulla pagina e la rete esterna
 * bloccata (analytics, Sentry, Clarity, Iubenda, Firebase...): i test non
 * devono dipendere da servizi terzi né sporcarne i dati.
 */
import { test as base, expect } from "@playwright/test";
import { FakeSupabase } from "./fakeSupabase";
import { PYGAME_PYODIDE_INDEX_URL, PYODIDE_INDEX_URL, SKULPT_URLS } from "../../src/lib/runtimes";

// Host esterni permessi: i runtime dei compilatori da jsDelivr, nelle versioni
// usate dal sito (Pyodide per Python e per Pygame Zero, Skulpt per Turtle).
const ALLOWED_EXTERNAL = [PYODIDE_INDEX_URL, PYGAME_PYODIDE_INDEX_URL, ...SKULPT_URLS];

/**
 * Turnstile finto al posto dello script di Cloudflare: ogni widget riceve
 * subito un token "e2e-turnstile-token-N", e uno nuovo a ogni reset().
 */
const TURNSTILE_STUB = `(() => {
  const widgets = new Map();
  let issued = 0;
  const issue = (id) => setTimeout(() => widgets.get(id)?.callback?.("e2e-turnstile-token-" + ++issued), 20);
  window.turnstile = {
    render(el, opts) { const id = "w" + widgets.size; widgets.set(id, opts); issue(id); return id; },
    reset(id) { issue(id); },
    remove(id) { widgets.delete(id); },
  };
})();`;

export const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => url.origin !== origin && !url.hostname.endsWith("e2e.test") && !ALLOWED_EXTERNAL.some((prefix) => url.href.startsWith(prefix)),
      (route) => route.abort("blockedbyclient"),
    );
    // Registrata dopo il blocco: Playwright prova per prima l'ultima route aggiunta
    await page.route(
      (url) => url.hostname === "challenges.cloudflare.com",
      (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE_STUB }),
    );
    const fake = new FakeSupabase();
    await fake.install(page);
    await use(fake);
  },
});

export { expect };

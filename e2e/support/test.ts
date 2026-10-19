/**
 * `test` con un Supabase finto già installato sulla pagina e la rete esterna
 * bloccata (analytics, Sentry, Clarity, Iubenda, Firebase...): i test non
 * devono dipendere da servizi terzi né sporcarne i dati.
 */
import { test as base, expect } from "@playwright/test";
import { FakeSupabase } from "./fakeSupabase";
import { PYODIDE_INDEX_URL, SKULPT_URLS } from "../../src/lib/runtimes";

// Host esterni permessi: i runtime dei compilatori da jsDelivr, nelle versioni
// usate dal sito (Pyodide per Python, Skulpt per Turtle).
const ALLOWED_EXTERNAL = [PYODIDE_INDEX_URL, ...SKULPT_URLS];

export const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => url.origin !== origin && !url.hostname.endsWith("e2e.test") && !ALLOWED_EXTERNAL.some((prefix) => url.href.startsWith(prefix)),
      (route) => route.abort("blockedbyclient"),
    );
    const fake = new FakeSupabase();
    await fake.install(page);
    await use(fake);
  },
});

export { expect };

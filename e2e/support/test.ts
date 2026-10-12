/**
 * `test` con un Supabase finto già installato sulla pagina e la rete esterna
 * bloccata (analytics, Sentry, Clarity, Iubenda, Firebase...): i test non
 * devono dipendere da servizi terzi né sporcarne i dati.
 */
import { test as base, expect } from "@playwright/test";
import { FakeSupabase } from "./fakeSupabase";

// Host esterni permessi: Pyodide (esecuzione del codice Python) viene da jsDelivr.
const ALLOWED_EXTERNAL = [/^https:\/\/cdn\.jsdelivr\.net\/pyodide\//];

export const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => url.origin !== origin && !url.hostname.endsWith("e2e.test") && !ALLOWED_EXTERNAL.some((re) => re.test(url.href)),
      (route) => route.abort("blockedbyclient"),
    );
    const fake = new FakeSupabase();
    await fake.install(page);
    await use(fake);
  },
});

export { expect };

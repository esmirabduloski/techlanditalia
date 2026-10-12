import { defineConfig, devices } from "@playwright/test";
import { FAKE_SUPABASE_URL } from "./e2e/support/fakeSupabase";

const PORT = 4321;

/**
 * Test end-to-end dei flussi che portano incassi (e2e/*.spec.ts).
 * L'app gira con il dev server Vite puntato a un Supabase finto
 * (e2e/support/fakeSupabase.ts): nessun dato vero viene letto o scritto.
 *
 *   npm run test:e2e          tutti i test
 *   npm run test:e2e -- --ui  modalità interattiva
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Le variabili d'ambiente già presenti battono i file .env di Vite.
    env: {
      VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "chiave-finta-e2e",
      VITE_SUPABASE_PROJECT_ID: "e2e",
      VITE_SENTRY_DSN: "",
    },
  },
});

import { test, expect } from "../support/test";
import { compitoUrl, impostaCodice, preparaAlunno, taskUrl } from "./apri";

/**
 * Pygame Zero: il sito non esegue il codice, lo mostra pronto per Replit
 * (intestazione "#pgzero main.py"), lo copia negli appunti e apre Replit.
 * L'esecuzione vera dei programmi è in e2e/compilatori/pgzero/esegui.py.
 */

const GIOCO = '#pgzero\nWIDTH = 400\nHEIGHT = 300\n\ndef draw():\n    screen.fill("darkblue")\n';
const PRONTO = GIOCO.replace("#pgzero", "#pgzero main.py");

test.beforeEach(async ({ fake, page }) => {
  // Pygame Zero non usa Pyodide: niente download
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
  await preparaAlunno(page, fake, "python-base", {
    python_env: "pgzero",
    default_python_code: GIOCO,
    replit_url: "https://replit.com/@techland/gioco-astronave",
  });
  // window.open registra l'URL invece di aprire Replit
  await page.addInitScript(() => {
    (window as unknown as { aperti: string[] }).aperti = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { aperti: string[] }).aperti.push(String(url));
      return null;
    };
  });
});

const aperti = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { aperti: string[] }).aperti);

test("task: codice pronto per Replit, copia negli appunti e link del task", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(taskUrl);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();

  const codice = page.getByTestId("pgzero-code");
  await expect(codice).toHaveText(PRONTO);

  await page.getByRole("button", { name: "Copia Codice" }).click();
  await expect(page.getByRole("button", { name: "Copiato!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PRONTO);

  await page.getByRole("button", { name: "Apri Replit" }).click();
  expect(await aperti(page)).toEqual(["https://replit.com/@techland/gioco-astronave"]);
});

test("compito: intestazione già giusta non raddoppiata e Replit di default", async ({ page, fake }) => {
  impostaCodice(fake, { python_env: "pgzero", default_python_code: PRONTO, replit_url: null });
  await page.goto(compitoUrl);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();
  await expect(page.getByTestId("pgzero-code")).toHaveText(PRONTO);

  await page.getByRole("button", { name: "Apri Replit" }).click();
  expect(await aperti(page)).toEqual(["https://replit.com/@esmir1475/Pygame"]);
});

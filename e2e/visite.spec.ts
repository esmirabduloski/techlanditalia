import { test, expect } from "./support/test";

/**
 * Misura delle visite: le nostre (page_views) e i tag di Google Tag Manager.
 * page_views la leggono solo gli admin, quindi l'insert non deve chiedere la
 * riga indietro; GTM non deve partire nelle aree private (minori, dati personali).
 */

test("la visita anonima viene registrata senza chiedere la riga indietro", async ({ page, fake }) => {
  const inserts: { url: URL; prefer: string }[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (req.method() === "POST" && url.pathname === "/rest/v1/page_views") {
      inserts.push({ url, prefer: req.headers()["prefer"] ?? "" });
    }
  });

  await page.goto("/corsi");

  await expect.poll(() => fake.table("page_views").length, { timeout: 10_000 }).toBe(1);
  const [row] = fake.table("page_views");
  expect(row).toMatchObject({ page_url: "/corsi", user_id: null });
  expect(String(row.id)).toMatch(/^[0-9a-f-]{36}$/);
  expect(inserts).toHaveLength(1);
  expect(inserts[0].url.searchParams.has("select")).toBe(false);
  expect(inserts[0].prefer).not.toContain("return=representation");
});

test("Google Tag Manager si carica sulle pagine pubbliche, non nelle aree private", async ({ page }) => {
  const gtm: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("https://www.googletagmanager.com/gtm.js")) gtm.push(new URL(page.url()).pathname);
  });

  await page.goto("/auth");
  await expect(page.getByLabel("Email o Nome Utente")).toBeVisible();
  expect(gtm).toEqual([]);

  await page.goto("/");
  await expect.poll(() => gtm).toEqual(["/"]);
});

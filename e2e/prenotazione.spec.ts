import { test, expect } from "./support/test";

/** Prenotazione della lezione di prova: è l'ingresso di ogni nuovo cliente. */

test.beforeEach(async ({ fake }) => {
  fake.seed("courses", [
    { slug: "python-base", title: "Python Base", emoji: "🐍", age_range: "10-14 anni", is_visible: true },
    { slug: "roblox", title: "Roblox Studio", emoji: "🎮", age_range: "8-12 anni", is_visible: true },
  ]);
});

async function fillForm(page: import("@playwright/test").Page) {
  await page.getByLabel("Nome del genitore *").fill("Maria Rossi");
  await page.getByLabel("Email *").fill("maria.rossi@example.com");
  await page.getByLabel("Telefono *").fill("+39 333 1234567");

  await page.getByRole("combobox").filter({ hasText: "Seleziona" }).click();
  await page.getByRole("option", { name: "10 anni" }).click();
  await page.getByRole("combobox").filter({ hasText: "Non sono sicuro" }).click();
  // Le opzioni arrivano dalla tabella courses
  await page.getByRole("option", { name: "🐍 Python Base (10-14 anni)" }).click();

  await page.getByRole("checkbox").check();
}

test("il genitore prenota la prova e la richiesta arriva a submit-booking", async ({ page, fake }) => {
  fake.fn("submit-booking", () => ({ body: { success: true } }));

  await page.goto("/prenota?ref=AMICO10");
  await fillForm(page);
  await page.getByRole("button", { name: "Prenota lezione gratuita" }).click();

  await expect(page.getByRole("heading", { name: "Richiesta ricevuta!" })).toBeVisible();

  const calls = fake.callsTo("submit-booking");
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toMatchObject({
    parentName: "Maria Rossi",
    email: "maria.rossi@example.com",
    phone: "+39 333 1234567",
    childAge: 10,
    interest: "python-base",
    referralCode: "AMICO10",
    website: "", // honeypot vuoto: non è un bot
    turnstileToken: expect.stringMatching(/^e2e-turnstile-token-/),
  });
  expect(typeof (calls[0].body as { formOpenedAt: unknown }).formOpenedAt).toBe("number");
});

test("senza privacy accettata il form non parte", async ({ page, fake }) => {
  await page.goto("/prenota");
  await page.getByLabel("Nome del genitore *").fill("Maria Rossi");
  await page.getByLabel("Email *").fill("maria.rossi@example.com");
  await page.getByLabel("Telefono *").fill("3331234567");
  await page.getByRole("button", { name: "Prenota lezione gratuita" }).click();

  await expect(page.getByText("Devi accettare la Privacy Policy")).toBeVisible();
  expect(fake.callsTo("submit-booking")).toHaveLength(0);
});

test("se il server rifiuta, il genitore vede l'errore e può riprovare", async ({ page, fake }) => {
  let attempts = 0;
  fake.fn("submit-booking", () => {
    attempts += 1;
    return attempts === 1
      ? { status: 429, body: { error: "Hai già inviato una richiesta di recente. Ti contatteremo presto!" } }
      : { body: { success: true } };
  });

  await page.goto("/prenota");
  await fillForm(page);
  await page.getByRole("button", { name: "Prenota lezione gratuita" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Errore nell'invio" });
  await expect(alert).toContainText("Hai già inviato una richiesta di recente");

  await page.getByRole("button", { name: "Prenota lezione gratuita" }).click();
  await expect(page.getByRole("heading", { name: "Richiesta ricevuta!" })).toBeVisible();
  expect(attempts).toBe(2);

  // Ogni token Turnstile vale una volta sola: il secondo invio ne usa uno nuovo
  const [first, second] = fake.callsTo("submit-booking").map((c) => (c.body as { turnstileToken?: string }).turnstileToken);
  expect(first).toMatch(/^e2e-turnstile-token-/);
  expect(second).toMatch(/^e2e-turnstile-token-/);
  expect(second).not.toBe(first);
});

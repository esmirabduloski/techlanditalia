import { test, expect } from "./support/test";
import { seedStudent, student } from "./support/seed";

/** Login alunno: senza accesso il cliente pagante non usa quello che ha comprato. */

test.beforeEach(async ({ fake }) => {
  seedStudent(fake);
  // Come la funzione vera: accetta email o nome utente e restituisce la sessione.
  fake.fn("student-login", (body, { fake }) => {
    const { identifier, password } = body as { identifier: string; password: string };
    const user = fake.users.find((u) => (u.username === identifier || u.email === identifier) && u.password === password);
    return user
      ? { body: { session: fake.createSession(user) } }
      : { status: 401, body: { error: "Nome utente o password non corretti" } };
  });
  fake.fn("check-login-attempts", () => ({ body: { blocked: false } }));
});

test("l'alunno entra con il nome utente e arriva alla sua dashboard", async ({ page, fake }) => {
  await page.goto("/auth");
  await page.getByLabel("Email o Nome Utente").fill(student.username!);
  await page.getByLabel("Password").fill(student.password);
  await page.getByRole("button", { name: "Accedi" }).last().click();

  await expect(page).toHaveURL(/\/area-riservata$/);
  await expect(page.getByRole("heading", { name: /Ciao, Luca Bianchi/ })).toBeVisible();
  await expect(page.getByText("Python Base").first()).toBeVisible();

  expect(fake.callsTo("student-login")[0].body).toEqual({ identifier: "luca123", password: student.password });
  // Con il nome utente non serve il controllo dei tentativi per email
  expect(fake.callsTo("check-login-attempts")).toHaveLength(0);
});

test("con l'email passa anche dal controllo dei tentativi", async ({ page, fake }) => {
  await page.goto("/auth");
  await page.getByLabel("Email o Nome Utente").fill(student.email);
  await page.getByLabel("Password").fill(student.password);
  await page.getByRole("button", { name: "Accedi" }).last().click();

  await expect(page).toHaveURL(/\/area-riservata$/);
  expect(fake.callsTo("check-login-attempts")[0].body).toEqual({ email: student.email, action: "check" });
});

test("password sbagliata: messaggio d'errore e nessun accesso", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Email o Nome Utente").fill(student.username!);
  await page.getByLabel("Password").fill("sbagliata");
  await page.getByRole("button", { name: "Accedi" }).last().click();

  await expect(page.getByText("Nome utente o password non corretti", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/auth$/);
});

test("account bloccato per troppi tentativi: il login non parte", async ({ page, fake }) => {
  fake.fn("check-login-attempts", () => ({ body: { blocked: true, retry_after_seconds: 600 } }));

  await page.goto("/auth");
  await page.getByLabel("Email o Nome Utente").fill(student.email);
  await page.getByLabel("Password").fill(student.password);
  await page.getByRole("button", { name: "Accedi" }).last().click();

  await expect(page.getByText("Account temporaneamente bloccato", { exact: true })).toBeVisible();
  expect(fake.callsTo("student-login")).toHaveLength(0);
});

test("chi apre l'area riservata senza sessione torna al login", async ({ page }) => {
  await page.goto("/area-riservata/acquisti");
  await expect(page).toHaveURL(/\/auth/);
});

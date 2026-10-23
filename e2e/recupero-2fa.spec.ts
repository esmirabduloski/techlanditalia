import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";

/**
 * Recupero della 2FA con il codice via email (edge function mfa-recovery +
 * verifyOtp). Il codice lo genera Supabase Auth con la lunghezza impostata nel
 * progetto (su Lovable Cloud 8 cifre, non 6): la schermata deve accettarlo
 * tutto, altrimenti chi ha perso l'app resta chiuso fuori.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
  factors: [{ id: "f0000000-0000-4000-8000-000000000001", factor_type: "totp", status: "verified", friendly_name: "iPhone" }],
};

test.beforeEach(async ({ fake }) => {
  fake.addUser(admin);
  fake.rpc("my_mfa_required", () => true);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
});

async function openRecovery(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await expect(page.getByText("Inserisci il codice a 6 cifre mostrato dalla tua app di autenticazione.")).toBeVisible();
  await page.getByRole("button", { name: "Non ho più accesso all'app" }).click();
  await page.getByRole("button", { name: "Inviami il codice" }).click();
}

test("accetta il codice email da 8 cifre e invia la richiesta all'admin", async ({ page, fake }) => {
  fake.fn("mfa-recovery", (body) =>
    (body as { action: string }).action === "send-code"
      ? { body: { success: true, codeLength: 8 } }
      : { body: { success: true } },
  );
  await fake.signInBeforeLoad(page, admin);
  await openRecovery(page);

  await expect(page.getByText(`Inserisci il codice a 8 cifre che ti abbiamo inviato a ${admin.email}.`)).toBeVisible();
  const send = page.getByRole("button", { name: "Invia richiesta" });
  const input = page.getByLabel("Codice a 8 cifre");
  await input.pressSequentially("123456");
  await expect(send).toBeDisabled();
  await input.pressSequentially("78");
  await expect(send).toBeEnabled();

  const verify = page.waitForRequest((r) => r.url().includes("/auth/v1/verify"));
  await send.click();
  expect((await verify).postDataJSON()).toMatchObject({ email: admin.email, token: "12345678", type: "email" });
  await expect(page.getByText(/Richiesta inviata/)).toBeVisible();
  expect(fake.callsTo("mfa-recovery").map((c) => (c.body as { action: string }).action)).toEqual(["send-code", "submit"]);
});

test("usa la lunghezza indicata da mfa-recovery (6 cifre)", async ({ page, fake }) => {
  fake.fn("mfa-recovery", () => ({ body: { success: true, codeLength: 6 } }));
  await fake.signInBeforeLoad(page, admin);
  await openRecovery(page);

  await expect(page.getByText(/Inserisci il codice a 6 cifre che ti abbiamo inviato/)).toBeVisible();
  await page.getByLabel("Codice a 6 cifre").pressSequentially("123456");
  await expect(page.getByRole("button", { name: "Invia richiesta" })).toBeEnabled();
});

test("senza lunghezza nella risposta (funzione non ancora ripubblicata) si aspetta 8 cifre", async ({ page, fake }) => {
  fake.fn("mfa-recovery", () => ({ body: { success: true } }));
  await fake.signInBeforeLoad(page, admin);
  await openRecovery(page);

  await expect(page.getByText(/Inserisci il codice a 8 cifre che ti abbiamo inviato/)).toBeVisible();
});

import { test, expect } from "./support/test";
import { parent, student } from "./support/seed";

/**
 * Il genitore imposta la password del figlio dall'area riservata, senza
 * scrivere alla segreteria. I controlli di proprietà, 2FA e sblocco del login
 * stanno nella edge function parent-set-child-password.
 */

test.beforeEach(async ({ fake }) => {
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null },
    {
      id: student.id,
      full_name: student.fullName,
      username: student.username,
      role: "student",
      parent_id: parent.id,
      total_points: 0,
      avatar_id: 1,
      lesson_balance: 0,
    },
  ]);
});

test("il genitore sceglie una nuova password e la vede da dare al figlio", async ({ page, fake }) => {
  fake.fn("parent-set-child-password", () => ({ body: { success: true } }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: "Nuova password" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Nuova password di ${student.fullName}` })).toBeVisible();

  // Controlli prima dell'invio: nessuna chiamata se la password non va
  await dialog.getByLabel("Nuova password").fill("corta1");
  await dialog.getByLabel("Ripeti la password").fill("corta1");
  await dialog.getByRole("button", { name: "Salva password" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("La password deve avere almeno 8 caratteri");

  await dialog.getByLabel("Nuova password").fill("Volpe-Blu-4827");
  await dialog.getByLabel("Ripeti la password").fill("Volpe-Blu-4826");
  await dialog.getByRole("button", { name: "Salva password" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Le due password non coincidono");
  expect(fake.callsTo("parent-set-child-password")).toHaveLength(0);

  await dialog.getByLabel("Ripeti la password").fill("Volpe-Blu-4827");
  await dialog.getByRole("button", { name: "Salva password" }).click();

  await expect(dialog.getByTestId("child-username")).toHaveText(student.username!);
  await expect(dialog.getByTestId("child-new-password")).toHaveText("Volpe-Blu-4827");
  expect(fake.callsTo("parent-set-child-password")[0].body).toEqual({
    childId: student.id,
    newPassword: "Volpe-Blu-4827",
  });
});

test("Genera propone una password valida in entrambi i campi", async ({ page, fake }) => {
  fake.fn("parent-set-child-password", () => ({ body: { success: true } }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: "Nuova password" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Genera" }).click();

  const generated = await dialog.getByLabel("Nuova password").inputValue();
  expect(generated).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  await expect(dialog.getByLabel("Ripeti la password")).toHaveValue(generated);

  await dialog.getByRole("button", { name: "Salva password" }).click();
  await expect(dialog.getByTestId("child-new-password")).toHaveText(generated);
});

test("l'errore della funzione compare nel dialog", async ({ page, fake }) => {
  fake.fn("parent-set-child-password", () => ({
    status: 400,
    body: { error: "Password troppo debole o già comparsa in fughe di dati. Scegline un'altra o premi \"Genera\"." },
  }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: "Nuova password" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nuova password").fill("Password123");
  await dialog.getByLabel("Ripeti la password").fill("Password123");
  await dialog.getByRole("button", { name: "Salva password" }).click();

  await expect(dialog.getByRole("alert")).toContainText("Password troppo debole");
  await expect(dialog.getByTestId("child-new-password")).toHaveCount(0);
});

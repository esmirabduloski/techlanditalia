import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { student } from "./support/seed";

/**
 * Admin → Privacy, "File degli studenti": trova i file caricati nel compilatore
 * web prima degli spazi privati (bucket pubblico web-compiler-assets) e li
 * sposta nel bucket privato, lasciando dove sono i materiali dei docenti.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};
const altroStudente = "33333333-3333-4333-8333-333333333333";

test.beforeEach(async ({ fake, page }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  await fake.signInBeforeLoad(page, admin);
});

test("l'admin trova i file degli studenti ancora pubblici e li sposta nello spazio privato", async ({ page, fake }) => {
  for (const key of [
    `web-compiler-assets/${student.id}/gatto-1.png`,
    `web-compiler-assets/${student.id}/stile-1.css`,
    `web-compiler-assets/${altroStudente}/cane-1.png`,
    "web-compiler-assets/task-attachments/esempio.png",
    "web-compiler-assets/editor-uploads/lezione.png",
  ]) fake.storageObjects.add(key);

  await page.goto("/admin/privacy");
  const card = page.getByTestId("student-files-privacy");
  await card.getByRole("button", { name: "Controlla" }).click();
  await expect(card.getByText("file degli studenti ancora nello spazio pubblico.")).toContainText("3");

  await card.getByRole("button", { name: "Sposta nello spazio privato" }).click();
  await expect(card.getByText("Spostati 3 file.")).toBeVisible();
  expect([...fake.storageObjects].sort()).toEqual([
    `student-web-assets/${student.id}/gatto-1.png`,
    `student-web-assets/${student.id}/stile-1.css`,
    `student-web-assets/${altroStudente}/cane-1.png`,
    "web-compiler-assets/editor-uploads/lezione.png",
    "web-compiler-assets/task-attachments/esempio.png",
  ]);

  await card.getByRole("button", { name: "Controlla" }).click();
  await expect(card.getByText("Nessun file degli studenti nello spazio pubblico.")).toBeVisible();
});

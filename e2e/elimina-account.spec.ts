import { test, expect } from "./support/test";
import { parent, student } from "./support/seed";

/**
 * Eliminazione dell'account dal Profilo del genitore (delete-my-account).
 * Gli account finiscono nel Cestino per 30 giorni (migrazione 0076): la pagina
 * lo dice prima e dopo la conferma. Login bloccato e ripristino identico sono
 * verificati in SQL (supabase/tests/rls/22_account_trash.sql).
 */

test.beforeEach(async ({ fake }) => {
  fake.addUser(parent).addUser(student);
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

test("il genitore elimina l'account sapendo che resta recuperabile per 30 giorni", async ({ page, fake }) => {
  fake.fn("delete-my-account", () => ({ body: { success: true, deletedChildren: 1, recoverableDays: 30 } }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata/profilo");

  await expect(page.getByText(`gli account di ${student.fullName}`, { exact: false })).toBeVisible();
  await expect(page.getByText(/Per 30 giorni possiamo ancora ripristinare tutto com'era/)).toBeVisible();

  await page.getByRole("button", { name: "Elimina il mio account" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("l'account studente collegato: per 30 giorni potremo ancora ripristinarli");
  const confirm = dialog.getByRole("button", { name: "Elimina account" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Digita ELIMINA").fill("elimina");
  await confirm.click();

  await expect(page.getByText("Account eliminato", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Se hai cambiato idea scrivici entro 30 giorni a info@techlanditalia.it: possiamo ancora ripristinarlo.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(fake.functionCalls.filter((c) => c.name === "delete-my-account").map((c) => c.body)).toEqual([
    { confirm: "ELIMINA" },
  ]);
});

test("se il cestino non è ancora attivo non elimina e lo dice", async ({ page, fake }) => {
  fake.fn("delete-my-account", () => ({
    status: 503,
    body: { error: "Al momento non è possibile eliminare l'account. Riprova più tardi o scrivici a info@techlanditalia.it." },
  }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata/profilo");

  await page.getByRole("button", { name: "Elimina il mio account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Digita ELIMINA").fill("ELIMINA");
  await dialog.getByRole("button", { name: "Elimina account" }).click();

  await expect(page.getByText("Impossibile eliminare l'account", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Al momento non è possibile eliminare l'account. Riprova più tardi o scrivici a info@techlanditalia.it.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/area-riservata\/profilo$/);
});

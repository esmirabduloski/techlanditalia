import { test, expect } from "./support/test";
import { course, student } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * Avatar 3D che cresce con i livelli: nel Profilo lo studente vede le 10 forme
 * del suo personaggio (quelle raggiunte a colori, le altre bloccate), sceglie
 * un altro personaggio e lo salva; la Dashboard mostra la forma del suo livello.
 */

function seedStudent(fake: FakeSupabase, points: number) {
  fake.addUser(student);
  fake.seed("profiles", [
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: null, total_points: points, avatar_id: 1, lesson_balance: 2, onboarding_completed: true },
  ]);
  fake.seed("courses", [course]);
}

test("nel profilo si vede l'evoluzione e si cambia personaggio", async ({ page, fake }) => {
  // 1200 punti = livello 5 (Inventore), il 6 arriva a 1500
  seedStudent(fake, 1200);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata/profilo");

  await expect(page.getByText("Evoluzione: Panda", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Livello \d+: forma ancora bloccata$/ })).toHaveCount(5);
  await expect(page.getByRole("img", { name: "Livello 5: Cintura arancione" })).toBeVisible();
  await expect(page.getByText("Prossima evoluzione: Cintura verde tra 300 punti")).toBeVisible();
  await expect(page.getByRole("img", { name: "Panda: Cintura arancione" })).toBeVisible();

  await page.getByRole("button", { name: "Drago", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drago", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Evoluzione: Drago", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Drago: Drago crestato" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Livello 1: Uovo misterioso" })).toBeVisible();

  await page.getByRole("button", { name: "Salva Avatar" }).click();
  await expect(page.getByText("Il tuo avatar è stato cambiato con successo.", { exact: true })).toBeVisible();
  expect(fake.table("profiles").find((p) => p.id === student.id)?.avatar_id).toBe(8);

  await page.goto("/area-riservata");
  await expect(page.getByRole("img", { name: "Drago: Drago crestato" })).toBeVisible();
});

test("al livello 10 la forma è leggendaria e niente è bloccato", async ({ page, fake }) => {
  seedStudent(fake, 6000);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata/profilo");

  await expect(page.getByRole("img", { name: /forma ancora bloccata/ })).toHaveCount(0);
  await expect(page.getByText("Hai raggiunto la forma leggendaria: Gran maestro!")).toBeVisible();
});

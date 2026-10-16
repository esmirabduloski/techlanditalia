import { test, expect } from "./support/test";
import { parent, seedStudent, student } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * Su telefono il genitore si muove nell'area riservata con la barra in basso
 * (Home, Calendario, Acquisti, Profilo) e trova Esci nel menu ☰.
 * Lo studente e il desktop non la vedono.
 */

function seedParent(fake: FakeSupabase) {
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 0, avatar_id: 2, lesson_balance: 3 },
  ]);
}

const bar = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Navigazione area genitori" });

test.describe("telefono", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("il genitore va su Acquisti e Profilo dalla barra in basso", async ({ page, fake }) => {
    seedParent(fake);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(bar(page)).toBeVisible();
    await expect(bar(page).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    // Il pulsante della chat sta sopra la barra, non la copre
    const chat = page.getByRole("button", { name: "Apri chat assistenza" });
    await expect(chat).toBeVisible();
    const [chatBox, barBox] = [await chat.boundingBox(), await bar(page).boundingBox()];
    expect(chatBox!.y + chatBox!.height).toBeLessThanOrEqual(barBox!.y);

    await bar(page).getByRole("link", { name: "Acquisti" }).click();
    await expect(page).toHaveURL(/\/area-riservata\/acquisti$/);
    await expect(bar(page).getByRole("link", { name: "Acquisti" })).toHaveAttribute("aria-current", "page");

    await bar(page).getByRole("link", { name: "Profilo" }).click();
    await expect(page).toHaveURL(/\/area-riservata\/profilo$/);
    await expect(page.getByRole("heading", { name: "Il tuo account" })).toBeVisible();
  });

  test("nel menu ☰ ci sono le pagine dell'area ed Esci, non la lezione gratuita", async ({ page, fake }) => {
    seedParent(fake);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");
    await expect(bar(page)).toBeVisible();

    await page.getByRole("button", { name: "Apri menu di navigazione" }).click();
    const menu = page.getByRole("navigation", { name: "Menu di navigazione mobile" });
    await expect(menu.getByRole("link", { name: "Acquisti" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Profilo" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Lezione gratuita" })).toHaveCount(0);

    await menu.getByRole("button", { name: "Esci" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("lo studente non vede la barra dei genitori", async ({ page, fake }) => {
    seedStudent(fake);
    await fake.signInBeforeLoad(page, student);
    await page.goto("/area-riservata");
    await expect(page.getByRole("heading", { name: /Ciao, Luca Bianchi/ })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });
});

test("da desktop la barra non c'è", async ({ page, fake }) => {
  seedParent(fake);
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");
  await expect(page.getByRole("heading", { name: "Ciao, Maria! 👋" })).toBeVisible();
  await expect(bar(page)).toBeHidden();
});

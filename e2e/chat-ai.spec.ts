import { test, expect } from "./support/test";
import { seedStudent, student } from "./support/seed";

/**
 * La chat del sito risponde con un'AI e deve dirlo prima della prima risposta
 * (art. 50 AI Act). Agli studenti, minori, non la mostriamo.
 */

// Footer e chat arrivano insieme quando il browser è libero (Layout)
const DEFERRED = { timeout: 10_000 };

test("il visitatore vede subito che in chat risponde un'intelligenza artificiale", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri chat con l'assistente AI" }).click(DEFERRED);

  await expect(page.getByText("Assistente virtuale AI · risposte automatiche")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("assistente di intelligenza artificiale, non a una persona");
  await expect(page.getByRole("note").getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByText(/Sono l'assistente virtuale di TECHLAND, un sistema di intelligenza artificiale/)).toBeVisible();
  await expect(page.getByText("Assistente AI", { exact: true })).toBeVisible();
});

test("lo studente non ha la chat", async ({ page, fake }) => {
  seedStudent(fake);
  fake.table("profiles").find((p) => p.id === student.id)!.role = "student";
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  await expect(page.getByRole("heading", { name: /Ciao, Luca Bianchi/ })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible(DEFERRED);
  await expect(page.getByRole("button", { name: "Apri chat con l'assistente AI" })).toHaveCount(0);
});

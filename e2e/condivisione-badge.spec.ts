import { test, expect } from "./support/test";
import { parent, student, course } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";
import type { Page } from "@playwright/test";

/**
 * Badge sui social dall'account dello studente: con 14 anni certi
 * (canSelfConsent, anno di nascita indicato dal genitore) condivide da solo,
 * dalla griglia dei badge e dalla celebrazione del badge nuovo. Prima i
 * pulsanti non ci sono e la condivisione passa dal genitore.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const year = new Date().getFullYear();

const firstLogin = {
  id: "ba000000-0000-4000-8000-000000000001",
  name: "Primo accesso",
  description: "Sei entrato per la prima volta",
  emoji: "🚀",
  category: "inizio",
  points_reward: 10,
};

const firstCode = {
  id: "ba000000-0000-4000-8000-000000000002",
  name: "Primo programma",
  description: "Hai eseguito il tuo primo codice",
  emoji: "🐍",
  category: "codice",
  points_reward: 20,
};

function seedStudent(fake: FakeSupabase, birthYear: number) {
  fake.addUser(parent);
  fake.addUser(student);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 340, avatar_id: 2, lesson_balance: 2, onboarding_completed: true },
  ]);
  fake.seed("courses", [course]);
  fake.seed("badges", [firstLogin, firstCode]);
  fake.seed("user_achievements", [{ user_id: student.id, badge_id: firstLogin.id, earned_at: "2026-10-01T10:00:00Z", badge: firstLogin }]);
  fake.seed("student_birth_years", [{ student_id: student.id, birth_year: birthYear }]);
}

/** WhatsApp e Facebook si aprono con window.open: lo registriamo invece di aprire la pagina. */
async function recordOpenedLinks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { opened: string[] };
    w.opened = [];
    window.open = (url?: string | URL) => {
      w.opened.push(String(url));
      return null;
    };
  });
}

const openedLinks = (page: Page) => page.evaluate(() => (window as unknown as { opened: string[] }).opened);

async function earnBadge(page: Page, fake: FakeSupabase) {
  // La celebrazione parte dal realtime: aspetta che l'app sia in ascolto
  await expect.poll(() => fake.listensForInsert("user_achievements", { user_id: student.id })).toBe(true);
  fake.emitInsert("user_achievements", { user_id: student.id, badge_id: firstCode.id, earned_at: new Date().toISOString(), badge: firstCode });
  await expect(page.getByText("🏅 Nuovo Badge!")).toBeVisible();
}

test("con 15 anni condivide il badge dalla griglia", async ({ page, fake }) => {
  seedStudent(fake, year - 15);
  await recordOpenedLinks(page);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: /Primo accesso/ }).click();
  const popover = page.getByRole("dialog");
  await expect(popover).toContainText("Sei entrato per la prima volta");
  await expect(popover).not.toContainText("Chiedi a un genitore");
  await popover.getByRole("button", { name: "Condividi" }).click();
  await page.getByRole("menuitem", { name: /WhatsApp/ }).click();

  const [link] = await openedLinks(page);
  expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(link.split("text=")[1]);
  expect(text).toContain('🚀 Ho ottenuto il badge "Primo accesso" su TechLand!');
  expect(text).not.toContain(student.fullName!.split(" ")[0]);
});

test("con 15 anni condivide il badge appena ottenuto dalla celebrazione", async ({ page, fake }) => {
  seedStudent(fake, year - 15);
  await recordOpenedLinks(page);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");
  await expect(page.getByRole("button", { name: /Primo accesso/ })).toBeVisible();

  await earnBadge(page, fake);
  const celebration = page.getByRole("alert").filter({ hasText: "Nuovo Badge!" });
  await expect(celebration).toContainText("Primo programma");
  await expect(celebration).not.toContainText("Fallo vedere a mamma o papà");

  // Aperto il menu, la celebrazione non si chiude da sola dopo 4 secondi
  await celebration.getByRole("button", { name: "Condividi" }).click();
  await page.waitForTimeout(4_500);
  await page.getByRole("menuitem", { name: /WhatsApp/ }).click();
  await expect(celebration).toBeVisible();

  const [link] = await openedLinks(page);
  expect(decodeURIComponent(link.split("text=")[1])).toContain('🐍 Ho ottenuto il badge "Primo programma" su TechLand!');

  await celebration.getByText("Tocca per continuare").click();
  await expect(page.getByText("🏅 Nuovo Badge!")).toHaveCount(0);
});

test("con 10 anni niente social: chiede a un genitore", async ({ page, fake }) => {
  seedStudent(fake, year - 10);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: /Primo accesso/ }).click();
  const popover = page.getByRole("dialog");
  await expect(popover).toContainText("Vuoi condividerlo? Chiedi a un genitore");
  await expect(popover.getByRole("button", { name: "Condividi" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await earnBadge(page, fake);
  const celebration = page.getByRole("alert").filter({ hasText: "Nuovo Badge!" });
  await expect(celebration).toContainText("Fallo vedere a mamma o papà");
  await expect(celebration.getByRole("button", { name: "Condividi" })).toHaveCount(0);
  // Senza pulsanti la celebrazione si chiude da sola
  await expect(page.getByText("🏅 Nuovo Badge!")).toHaveCount(0, { timeout: 6_000 });
});

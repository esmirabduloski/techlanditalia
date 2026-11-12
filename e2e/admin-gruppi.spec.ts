import { test, expect } from "./support/test";
import { course } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Pagina Admin → Gruppi: schede Attivi/Archiviati/Tutti, ricerca, azioni
 * principali in vista e le altre nel menu "Altro", schede da telefono.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const teacher = { id: "33333333-3333-4333-8333-333333333333", full_name: "Sara Neri", email: "sara@techland.test", role: "teacher" };

const base = {
  course_id: course.id, teacher_id: teacher.id, max_lessons: 32, whatsapp_link: null, mega_chat_link: null,
  teacher_meeting_link: null, student_meeting_link: null, certificates: [], archived_at: null,
  last_lesson_title: null, courses: { title: course.title, emoji: course.emoji },
};

function seed(fake: FakeSupabase) {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email }, teacher]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }, { user_id: teacher.id, role: "teacher" }]);
  fake.seed("courses", [course]);
  fake.seed("student_groups", [
    { ...base, id: "e0000000-0000-4000-8000-000000000001", title: "Python sabato", start_date: "2026-10-03", lesson_days: [6], lesson_time: "10:00:00", status: "active" },
    { ...base, id: "e0000000-0000-4000-8000-000000000002", title: "Python mercoledì", start_date: "2026-10-07", lesson_days: [3, 1], lesson_time: "17:30:00", status: "active", teacher_id: null },
    { ...base, id: "e0000000-0000-4000-8000-000000000003", title: "Vecchio gruppo", start_date: "2025-10-04", lesson_days: [0], lesson_time: "09:00:00", status: "archived", archived_at: "2026-06-01" },
  ]);
}

test("schede, ricerca e menu delle azioni", async ({ page, fake }) => {
  seed(fake);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/gruppi");
  await expect(page.getByRole("heading", { name: "Gestione Gruppi" })).toBeVisible();
  await expect(page.getByText("2 gruppi attivi · 1 archiviato")).toBeVisible();

  const table = page.locator("table");
  await expect(page.getByRole("tab", { name: "Attivi (2)" })).toHaveAttribute("aria-selected", "true");
  await expect(table.getByText("Python sabato")).toBeVisible();
  await expect(table.getByText("Lun, Mer · 17:30")).toBeVisible();
  await expect(table.getByText("Vecchio gruppo")).toHaveCount(0);

  await page.screenshot({ path: "test-results/admin-gruppi-desktop.png", fullPage: true });

  await page.getByRole("tab", { name: "Archiviati (1)" }).click();
  await expect(table.getByText("Vecchio gruppo")).toBeVisible();
  await expect(table.getByText("Python sabato")).toHaveCount(0);

  await page.getByRole("tab", { name: "Tutti (3)" }).click();
  await page.getByLabel("Cerca gruppi").fill("mercoledi");
  await expect(table.getByText("Python mercoledì")).toBeVisible();
  await expect(table.getByText("Python sabato")).toHaveCount(0);
  await page.getByLabel("Cerca gruppi").fill("nessuno così");
  await expect(page.getByText('Nessun gruppo trovato per "nessuno così".')).toBeVisible();
  await page.getByLabel("Cerca gruppi").fill("sara");
  await expect(table.getByText("Python sabato")).toBeVisible();

  // Menu "Altro": voci con il nome, poi la finestra si apre e si usa
  await page.getByRole("button", { name: "Altre azioni per Python sabato" }).click();
  for (const name of ["Timeline programma", "Trasferisci studenti", "Unisci / Dividi gruppo", "Copia ID del gruppo", "Reset presenze", "Archivia gruppo", "Elimina gruppo"]) {
    await expect(page.getByRole("menuitem", { name })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/admin-gruppi-menu.png" });
  await page.getByRole("menuitem", { name: "Elimina gruppo" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // Dopo la finestra la pagina resta cliccabile
  await page.getByRole("row", { name: /Python sabato/ }).getByRole("button", { name: "Modifica" }).click();
  await expect(page.getByRole("dialog", { name: "Modifica Gruppo" })).toBeVisible();
});

test("da telefono i gruppi sono schede", async ({ page, fake }) => {
  seed(fake);
  await page.setViewportSize({ width: 390, height: 844 });
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/gruppi");
  await expect(page.getByRole("heading", { name: "Gestione Gruppi" })).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
  await expect(page.getByText("Python sabato").locator("visible=true")).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendario" }).locator("visible=true").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/admin-gruppi-telefono.png", fullPage: true });
});

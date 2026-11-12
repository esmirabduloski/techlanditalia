import { test, expect } from "./support/test";
import { parent, student, seedStudent } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Secondo link per entrare a lezione, per singolo studente (Admin → Utenti).
 * Lo studente e il genitore vedono un pulsante "Entra a lezione" in più con il
 * testo scelto dall'admin, sempre, anche senza lezione in calendario.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const LINK = { label: "LINK PER GRUPPO DEL MARTEDÌ", url: "https://meet.example.test/martedi" };
const extraButton = (page: import("@playwright/test").Page) =>
  page.getByTestId("extra-meeting-links").getByRole("link", { name: /Entra a lezione/ });

test("lo studente vede il secondo pulsante anche senza lezioni in calendario", async ({ page, fake }) => {
  seedStudent(fake);
  fake.seed("student_extra_meeting_links", [{ student_id: student.id, ...LINK }]);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  await expect(extraButton(page)).toHaveAttribute("href", LINK.url);
  await expect(extraButton(page)).toContainText(LINK.label);
  await expect(extraButton(page)).not.toContainText("Luca");
  // Il pulsante grande del giorno di lezione non c'è: nessuna lezione oggi
  await expect(page.getByRole("link", { name: /^🚀 ENTRA A LEZIONE/ })).toHaveCount(0);
});

test("senza secondo link non compare niente", async ({ page, fake }) => {
  seedStudent(fake);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");
  await expect(page.getByText(/Ciao/).first()).toBeVisible();
  await expect(page.getByTestId("extra-meeting-links")).toHaveCount(0);
});

test.describe("genitore dal telefono", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("vede il pulsante con il nome del figlio", async ({ page, fake }) => {
    fake.addUser(parent);
    fake.seed("profiles", [
      { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
      { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 0, avatar_id: 2, lesson_balance: 6 },
    ]);
    fake.seed("student_extra_meeting_links", [{ student_id: student.id, ...LINK }]);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(extraButton(page)).toContainText(`Luca · ${LINK.label}`);
    await expect(extraButton(page)).toHaveAttribute("href", LINK.url);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBe(390);
    await page.screenshot({ path: "test-results/secondo-link-genitore.png" });
  });
});

test("l'admin aggiunge, controlla e toglie il secondo link da Utenti", async ({ page, fake }) => {
  fake.addUser(admin);
  fake.seed("profiles", [
    { id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email },
    { id: parent.id, full_name: parent.fullName, email: parent.email, role: "parent", parent_id: null, total_points: 0, avatar_id: 1, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 0, avatar_id: 2, lesson_balance: 4 },
  ]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");

  await page.getByRole("heading", { name: parent.fullName }).click();
  await page.getByRole("button", { name: `Secondo link lezione di ${student.fullName}` }).click();
  const dialog = page.getByRole("dialog", { name: `Secondo link lezione - ${student.fullName}` });

  await dialog.getByLabel("Testo del pulsante").fill(LINK.label);
  await dialog.getByLabel("Link della lezione").fill("meet.example.test/martedi");
  await expect(dialog.getByRole("alert")).toContainText("https://");
  await expect(dialog.getByRole("button", { name: "Salva" })).toBeDisabled();

  await dialog.getByLabel("Link della lezione").fill(LINK.url);
  await expect(dialog.getByText("Anteprima per lo studente")).toBeVisible();
  await page.screenshot({ path: "test-results/secondo-link-admin.png" });
  await dialog.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Secondo link salvato", { exact: true })).toBeVisible();
  expect(fake.table("student_extra_meeting_links")).toEqual([expect.objectContaining({ student_id: student.id, ...LINK })]);

  // Il pulsante della riga mostra che c'è; si riapre con i dati e si toglie
  const rowButton = page.getByRole("button", { name: `Secondo link lezione di ${student.fullName}` });
  await expect(rowButton).toContainText("2° link");
  await rowButton.click();
  await expect(dialog.getByLabel("Testo del pulsante")).toHaveValue(LINK.label);
  await dialog.getByRole("button", { name: "Togli il link" }).click();
  await expect(page.getByText("Secondo link tolto", { exact: true })).toBeVisible();
  expect(fake.table("student_extra_meeting_links")).toEqual([]);
});

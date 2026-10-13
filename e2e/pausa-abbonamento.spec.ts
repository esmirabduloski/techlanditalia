import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Pausa dell'abbonamento: l'admin mette in pausa uno studente dalla scheda del
 * lead (per estate, esami o malattia) e il CRM mostra la famiglia IN PAUSA.
 * Che il saldo non venga scalato è verificato in SQL (05_subscription_pause.sql).
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const lead = {
  id: "e0000000-0000-4000-8000-000000000001",
  email: parent.email,
  full_name: parent.fullName,
  phone: null,
  source: "registered",
  pipeline_stage: "won",
  tags: [],
  lead_score: 0,
  lifetime_value_cents: 0,
  linked_profile_id: parent.id,
  deleted_at: null,
  next_followup_at: null,
  created_at: "2026-09-01T10:00:00Z",
};

test.beforeEach(async ({ fake, page }) => {
  fake.addUser(admin);
  fake.seed("profiles", [
    { id: admin.id, full_name: admin.fullName, role: "admin" },
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null },
    { id: student.id, full_name: student.fullName, role: "student", parent_id: parent.id },
  ]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("crm_leads", [lead]);
  await fake.signInBeforeLoad(page, admin);
});

test("la famiglia con un figlio in pausa ha il badge IN PAUSA nel CRM", async ({ page, fake }) => {
  fake.seed("subscription_pauses", [{
    student_id: student.id,
    reason: "summer",
    starts_on: "2026-07-01",
    ends_on: "2099-09-08",
    ended_at: null,
    notes: null,
    // Il fake non fa join: la risorsa annidata sta già nella riga
    student: { id: student.id, full_name: student.fullName, parent_id: parent.id },
  }]);
  await page.goto("/admin/crm");
  await expect(page.getByText("IN PAUSA").first()).toBeVisible();

  await page.getByText(parent.fullName!, { exact: true }).first().click();
  await expect(page.getByText(`In pausa · Estate, fino al 08/09/2099`)).toBeVisible();
});

test("l'admin mette in pausa lo studente e poi lo fa riprendere", async ({ page, fake }) => {
  await page.goto("/admin/crm");
  await page.getByText(parent.fullName!, { exact: true }).first().click();

  await page.getByRole("button", { name: "Metti in pausa" }).click();
  const dialog = page.getByRole("dialog", { name: `Metti in pausa ${student.fullName}` });
  await dialog.getByLabel("Ripresa il").fill("2099-09-08");
  await dialog.getByLabel("Note").fill("Vacanze al mare");
  await dialog.getByRole("button", { name: "Metti in pausa" }).click();

  await expect(page.getByText(`In pausa · Estate, fino al 08/09/2099`)).toBeVisible();
  const [pause] = fake.table("subscription_pauses");
  expect(pause).toMatchObject({
    student_id: student.id,
    reason: "summer",
    ends_on: "2099-09-08",
    notes: "Vacanze al mare",
    created_by: admin.id,
  });
  expect(fake.table("crm_interactions")).toEqual([
    expect.objectContaining({
      lead_id: lead.id,
      type: "status_change",
      subject: `Abbonamento di ${student.fullName} in pausa`,
    }),
  ]);

  await page.getByRole("button", { name: "Gestisci pausa" }).click();
  await page.getByRole("button", { name: "Riprendi ora" }).click();

  await expect(page.getByText("Attivo", { exact: true })).toBeVisible();
  expect(fake.table("subscription_pauses")[0]).toMatchObject({ end_reason: "manual", ended_by: admin.id });
  expect(fake.table("subscription_pauses")[0].ended_at).toEqual(expect.any(String));
});

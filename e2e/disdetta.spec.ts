import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Questionario di disdetta: l'admin registra dalla scheda del lead perché la
 * famiglia lascia (tre domande) e ritrova i motivi in Analytics.
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

test("l'admin registra la disdetta con il questionario e il lead va in Perso", async ({ page, fake }) => {
  fake.seed("subscription_pauses", [{
    id: "d0000000-0000-4000-8000-000000000001",
    student_id: student.id,
    reason: "summer",
    starts_on: "2026-07-01",
    ends_on: null,
    ended_at: null,
    student: { id: student.id, full_name: student.fullName, parent_id: parent.id },
  }]);
  await page.goto("/admin/crm");
  await page.getByText(parent.fullName!, { exact: true }).first().click();

  await page.getByRole("button", { name: "Registra disdetta" }).click();
  const dialog = page.getByRole("dialog", { name: "Registra disdetta" });
  const save = dialog.getByRole("button", { name: "Registra disdetta" });
  await expect(save).toBeDisabled();

  await dialog.getByLabel("Orari / giorni delle lezioni").check();
  await dialog.getByLabel("2. Cosa vi avrebbe fatto restare?").fill("Un corso al sabato mattina");
  await dialog.getByLabel("Forse").check();
  await save.click();

  await expect(page.getByLabel("Disdette registrate")).toContainText("Orari / giorni delle lezioni");
  expect(fake.table("subscription_cancellations")).toEqual([
    expect.objectContaining({
      lead_id: lead.id,
      student_id: student.id,
      reason: "schedule",
      would_have_stayed: "Un corso al sabato mattina",
      would_return: "maybe",
      created_by: admin.id,
    }),
  ]);
  expect(fake.table("crm_leads")[0].pipeline_stage).toBe("lost");
  // Chi disdice non resta in pausa
  expect(fake.table("subscription_pauses")[0]).toMatchObject({ end_reason: "manual" });
  expect(fake.table("crm_interactions")).toEqual([
    expect.objectContaining({ lead_id: lead.id, subject: `Disdetta: ${student.fullName}` }),
  ]);
});

test("in Analytics si vede perché le famiglie disdicono", async ({ page, fake }) => {
  fake.seed("subscription_cancellations", [
    { lead_id: lead.id, reason: "cost", would_return: "no", would_have_stayed: "Sconto fratelli", cancelled_on: "2026-10-01" },
    { lead_id: lead.id, reason: "cost", would_return: "maybe", would_have_stayed: null, cancelled_on: "2026-09-20" },
    { lead_id: lead.id, reason: "moving", would_return: "yes", would_have_stayed: null, cancelled_on: "2026-09-10" },
  ]);
  await page.goto("/admin/crm");
  await page.getByRole("tab", { name: /Analytics/ }).click();

  await expect(page.getByText("Perché le famiglie disdicono")).toBeVisible();
  await expect(page.getByText("2 (67%)")).toBeVisible();
  await expect(page.getByText("“Sconto fratelli”")).toBeVisible();
});

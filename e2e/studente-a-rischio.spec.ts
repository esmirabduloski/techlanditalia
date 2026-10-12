import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Avviso "studente a rischio abbandono": l'admin trova nella scheda "Da chiamare"
 * del CRM la famiglia da sentire, chiama e chiude l'attività con l'esito.
 * Il controllo vero (student-risk-check) è testato in SQL e con vitest: qui la
 * funzione è finta e serve solo a verificare il pulsante "Controlla ora".
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
  phone: "+39 333 123 4567",
  source: "registered",
  pipeline_stage: "won",
  tags: [],
  lead_score: 0,
  lifetime_value_cents: 0,
  linked_profile_id: parent.id,
  deleted_at: null,
  next_followup_at: null,
};

// Il fake non fa join: le risorse annidate stanno già nella riga
const refs = {
  crm_leads: { full_name: lead.full_name, email: lead.email, phone: lead.phone },
  student: { full_name: student.fullName },
};

const openTask = {
  id: "f0000000-0000-4000-8000-000000000001",
  lead_id: lead.id,
  student_id: student.id,
  kind: "student_at_risk",
  title: `Chiama la famiglia di ${student.fullName}`,
  status: "open",
  due_at: "2026-10-13T06:30:00Z",
  signals: [
    { kind: "consecutive_absences", key: "consecutive_absences:g1", label: "2 assenze di fila (Python Junior)" },
    { kind: "missing_homework", key: "missing_homework", label: "Compito non consegnato: Calcolatrice" },
  ],
  ...refs,
};

test.beforeEach(async ({ fake, page }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("crm_leads", [lead]);
  await fake.signInBeforeLoad(page, admin);
});

test("l'admin chiama la famiglia e chiude l'attività con l'esito", async ({ page, fake }) => {
  fake.seed("crm_tasks", [openTask]);
  await page.goto("/admin/crm?tab=da-chiamare");

  const tab = page.getByRole("tab", { name: /Da chiamare/ });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab.getByLabel("1 famiglie da chiamare")).toBeVisible();

  const item = page.getByTestId("crm-task");
  await expect(item).toContainText(student.fullName!);
  await expect(item).toContainText("2 assenze di fila (Python Junior)");
  await expect(item).toContainText("Compito non consegnato: Calcolatrice");
  await expect(item.getByRole("link", { name: lead.phone })).toHaveAttribute("href", "tel:+393331234567");

  await item.getByRole("button", { name: "Fatto" }).click();
  await page.getByLabel("Esito (facoltativo)").fill("Influenza, rientra lunedì");
  await page.getByRole("button", { name: "Segna come fatta" }).click();

  await expect(page.getByText("Nessuna famiglia da chiamare.")).toBeVisible();
  await expect(tab.getByLabel(/famiglie da chiamare/)).toHaveCount(0);

  const [task] = fake.table("crm_tasks");
  expect(task).toMatchObject({ status: "done", outcome: "Influenza, rientra lunedì", completed_by: admin.id });
  expect(fake.table("crm_interactions")).toEqual([
    expect.objectContaining({
      lead_id: lead.id,
      type: "call",
      subject: `Chiamata alla famiglia: ${student.fullName} a rischio abbandono`,
      content: "Influenza, rientra lunedì",
    }),
  ]);
  expect(fake.table("crm_leads")[0].last_contacted_at).toEqual(expect.any(String));
});

test("\"Controlla ora\" lancia il controllo e mostra le nuove attività", async ({ page, fake }) => {
  fake.fn("student-risk-check", (_body, { fake }) => {
    fake.seed("crm_tasks", [openTask]);
    return {
      body: { ok: true, students: 1, created: 1, updated: 0, unchanged: 0, cooldown: 0, leads_created: 0, skipped: [] },
    };
  });
  await page.goto("/admin/crm?tab=da-chiamare");
  await expect(page.getByText("Nessuna famiglia da chiamare.")).toBeVisible();

  await page.getByRole("button", { name: "Controlla ora" }).click();

  await expect(page.getByText("1 studente a rischio", { exact: true })).toBeVisible();
  await expect(page.getByTestId("crm-task")).toContainText(student.fullName!);
  const [call] = fake.callsTo("student-risk-check");
  expect(call.authorization).toMatch(/^Bearer ey/);
});

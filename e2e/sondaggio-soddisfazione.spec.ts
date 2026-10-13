import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Sondaggio di soddisfazione: la famiglia risponde dall'area riservata. Chi è
 * soddisfatto vede l'invito Trustpilot e il proprio link referral, un voto
 * basso promette una chiamata. Quando parte il sondaggio è verificato in SQL
 * (supabase/tests/rls/07_satisfaction_survey.sql).
 */

const SURVEY_ID = "5a000000-0000-4000-8000-000000000001";
const TRUSTPILOT = "https://it.trustpilot.com/evaluate/techlanditalia.it";
const REFERRAL = "https://techlanditalia.it/prenota?ref=MARIA123";

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const pendingSurvey = {
  id: SURVEY_ID,
  student_id: student.id,
  recipient_id: parent.id,
  group_id: null,
  kind: "module_end",
  module_number: 2,
  module_title: "Torre nell'Inferno",
  status: "pending",
  score: null,
  comment: null,
  sent_at: "2026-10-12T16:00:00Z",
  created_at: "2026-10-12T16:00:00Z",
  // Il fake non fa join: la risorsa annidata sta già nella riga
  student: { full_name: student.fullName },
};

test.beforeEach(async ({ fake }) => {
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, referral_code: "MARIA123" },
    { id: student.id, full_name: student.fullName, role: "student", parent_id: parent.id, total_points: 0, lesson_balance: 0 },
  ]);
});

test("il genitore soddisfatto riceve l'invito Trustpilot e il link referral", async ({ page, fake }) => {
  fake.seed("satisfaction_surveys", [pendingSurvey]);
  fake.fn("satisfaction-survey", () => ({
    body: { ok: true, satisfied: true, follow_up: false, trustpilot_url: TRUSTPILOT, referral_link: REFERRAL, referral_code: "MARIA123" },
  }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto(`/area-riservata?sondaggio=${SURVEY_ID}`);

  await expect(page.getByRole("heading", { name: "Luca ha finito il modulo «Torre nell'Inferno»: com'è andata?" })).toBeVisible();
  const send = page.getByRole("button", { name: "Invia" });
  await expect(send).toBeDisabled();
  await page.getByRole("radio", { name: "10 su 10" }).click();
  await page.getByLabel("Cosa vi è piaciuto, o cosa possiamo migliorare?").fill("Luca non vede l'ora di ogni lezione");
  await send.click();

  const thanks = page.getByTestId("satisfaction-survey-thanks");
  await expect(thanks.getByText("Grazie per la risposta!")).toBeVisible();
  await expect(thanks.getByRole("link", { name: "Scrivi la recensione" })).toHaveAttribute("href", TRUSTPILOT);
  await expect(thanks.getByLabel("Il tuo link d'invito")).toHaveValue(REFERRAL);
  await expect(page.getByRole("button", { name: "Invia" })).toHaveCount(0);

  const [call] = fake.callsTo("satisfaction-survey");
  expect(call.body).toEqual({
    action: "respond",
    survey_id: SURVEY_ID,
    score: 10,
    comment: "Luca non vede l'ora di ogni lezione",
  });
  expect(call.authorization).toMatch(/^Bearer ey/);
});

test("con un voto basso niente inviti: la segreteria richiama", async ({ page, fake }) => {
  fake.seed("satisfaction_surveys", [{ ...pendingSurvey, kind: "after_3_lessons", module_number: null, module_title: null }]);
  fake.fn("satisfaction-survey", () => ({
    body: { ok: true, satisfied: false, follow_up: true, trustpilot_url: null, referral_link: null, referral_code: null },
  }));
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  await expect(page.getByRole("heading", { name: "Come sono andate le prime lezioni di Luca?" })).toBeVisible();
  await page.getByRole("radio", { name: "4 su 10" }).click();
  await page.getByRole("button", { name: "Invia" }).click();

  const thanks = page.getByTestId("satisfaction-survey-thanks");
  await expect(thanks.getByText(/la segreteria ti contatterà/)).toBeVisible();
  await expect(thanks.getByRole("link", { name: "Scrivi la recensione" })).toHaveCount(0);
  await expect(thanks.getByLabel("Il tuo link d'invito")).toHaveCount(0);
});

test("nel CRM l'admin vede NPS e commenti", async ({ page, fake }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  const answered = (id: string, score: number, comment: string | null) => ({
    ...pendingSurvey,
    id,
    status: "answered",
    score,
    comment,
    answered_at: "2026-10-12T18:00:00Z",
  });
  fake.seed("satisfaction_surveys", [
    answered("5a000000-0000-4000-8000-000000000011", 10, "Bravissimi"),
    answered("5a000000-0000-4000-8000-000000000012", 9, null),
    answered("5a000000-0000-4000-8000-000000000013", 5, "Orario scomodo"),
    { ...pendingSurvey, id: "5a000000-0000-4000-8000-000000000014" },
  ]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/crm");
  await page.getByRole("tab", { name: "Analytics" }).click();

  const stats = page.getByTestId("crm-satisfaction-stats");
  // 2 promotori, 1 detrattore su 3 risposte: NPS 33
  await expect(stats.getByText("33", { exact: true })).toBeVisible();
  await expect(stats.getByText("3/4")).toBeVisible();
  await expect(stats.getByText("“Orario scomodo”")).toBeVisible();
});

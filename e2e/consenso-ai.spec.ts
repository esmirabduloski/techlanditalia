import { test, expect } from "./support/test";
import type { FakeSupabase } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Consenso agli strumenti AI (L. 132/2025, art. 4 c. 4): sotto i 14 anni
 * decide il genitore, dai 14 anche lo studente. Finché non c'è uno strumento
 * AI (nessuna versione dell'informativa) non si chiede nulla. Le regole vere
 * (età, versione, chi può decidere) sono verificate in SQL
 * (supabase/tests/rls/11_ai_consent.sql): qui le RPC finte salvano e basta.
 */

const VERSION = "2026-11-01";
const thisYear = new Date().getFullYear();

function aiServer(fake: FakeSupabase, version: string | null, canSelfConsent = false) {
  const upsert = (table: string, row: Record<string, unknown>) => {
    const rows = fake.table(table);
    const i = rows.findIndex((r) => r.student_id === row.student_id);
    if (i >= 0) rows[i] = row;
    else rows.push(row);
  };
  fake.rpc("current_ai_consent_version", () => version);
  fake.rpc("set_ai_consent", (args, { userId }) => {
    const { _student, _granted } = args as { _student: string; _granted: boolean };
    upsert("ai_consents", {
      student_id: _student,
      granted: _granted,
      version,
      decided_by: userId,
      decided_as: userId === _student ? "student" : "parent",
      decided_at: new Date().toISOString(),
    });
    return null;
  });
  fake.rpc("set_student_birth_year", (args) => {
    const { _student, _year } = args as { _student: string; _year: number };
    upsert("student_birth_years", { student_id: _student, birth_year: _year });
    return null;
  });
  fake.rpc("my_ai_access", (_args, { fake: f, userId }) => {
    // Come nel database: gli adulti non hanno bisogno del consenso
    if (f.table("profiles").find((p) => p.id === userId)?.role !== "student") {
      return { version, status: version ? "adult" : "no_tools", allowed: !!version, can_self_consent: false };
    }
    const consent = f.table("ai_consents").find((r) => r.student_id === userId);
    const status = !version ? "no_tools" : !consent ? "none" : consent.granted ? "granted" : "revoked";
    return { version, status, allowed: status === "granted", can_self_consent: canSelfConsent };
  });
}

test.beforeEach(async ({ fake }) => {
  fake.addUser(parent).addUser(student);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null },
    {
      id: student.id,
      full_name: student.fullName,
      username: student.username,
      role: "student",
      parent_id: parent.id,
      total_points: 0,
      avatar_id: 1,
      lesson_balance: 0,
    },
  ]);
});

test("senza strumenti AI al genitore non si chiede nulla", async ({ page, fake }) => {
  aiServer(fake, null);
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata/profilo");

  // La scheda foto e video c'è: la pagina è pronta, e quella AI no
  await expect(page.getByText("Foto e video", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ai-consent-card")).toHaveCount(0);

  await page.goto("/area-riservata");
  await expect(page.getByTestId("recording-consent-prompt")).toBeVisible();
  await expect(page.getByTestId("ai-consent-prompt")).toHaveCount(0);
});

test("il genitore indica l'anno di nascita e attiva gli strumenti AI dal Profilo", async ({ page, fake }) => {
  aiServer(fake, VERSION);
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata/profilo");

  const card = page.getByTestId("ai-consent-card");
  await expect(card.getByRole("heading", { name: "Strumenti di intelligenza artificiale" })).toBeVisible();
  await expect(card.getByText("Non attivo")).toBeVisible();

  await card.getByLabel("Anno di nascita").click();
  await page.getByRole("option", { name: String(thisYear - 12), exact: true }).click();
  await expect(card.getByText("Fino all'anno dopo i 14 anni decidi tu.")).toBeVisible();
  expect(fake.table("student_birth_years")).toEqual([{ student_id: student.id, birth_year: thisYear - 12 }]);

  // L'interruttore è un checkbox nascosto: si clicca l'etichetta, come fa l'utente
  await expect(card.getByRole("switch", { name: student.fullName })).not.toBeChecked();
  await card.getByText(student.fullName, { exact: true }).click();
  await expect(card.getByRole("switch", { name: student.fullName })).toBeChecked();
  await expect(card.getByText(/^Attivato da te il \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  expect(fake.table("ai_consents")).toMatchObject([{ student_id: student.id, granted: true, version: VERSION }]);
  // Il genitore è adulto: la scheda dello studente non compare
  await expect(page.getByTestId("student-ai-consent-card")).toHaveCount(0);
});

test("in dashboard il genitore può dire di no e l'avviso non torna", async ({ page, fake }) => {
  aiServer(fake, VERSION);
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  const prompt = page.getByTestId("ai-consent-prompt");
  await expect(prompt.getByRole("heading", { name: "Vuoi attivare gli strumenti AI per Luca?" })).toBeVisible();
  await prompt.getByRole("button", { name: "No, grazie" }).click();
  await expect(prompt).toHaveCount(0);
  expect(fake.table("ai_consents")).toMatchObject([{ student_id: student.id, granted: false }]);

  await page.reload();
  await expect(page.getByTestId("recording-consent-prompt")).toBeVisible();
  await expect(page.getByTestId("ai-consent-prompt")).toHaveCount(0);
});

test("sotto i 14 anni lo studente deve chiedere al genitore", async ({ page, fake }) => {
  aiServer(fake, VERSION, false);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata/profilo");

  const card = page.getByTestId("student-ai-consent-card");
  await expect(
    card.getByText("Per usare gli strumenti AI serve il permesso di un genitore: chiedigli di attivarli dal suo Profilo."),
  ).toBeVisible();
  await expect(card.getByRole("button", { name: "Attiva strumenti AI" })).toHaveCount(0);
});

test("dai 14 anni lo studente si attiva gli strumenti AI da solo e può disattivarli", async ({ page, fake }) => {
  aiServer(fake, VERSION, true);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata/profilo");

  const card = page.getByTestId("student-ai-consent-card");
  await expect(card.getByText(/Hai almeno 14 anni, quindi puoi decidere tu/)).toBeVisible();
  await card.getByRole("button", { name: "Attiva strumenti AI" }).click();

  await expect(card.getByText("Sono attivi: puoi usarli nelle attività che li prevedono.")).toBeVisible();
  expect(fake.table("ai_consents")).toMatchObject([
    { student_id: student.id, granted: true, version: VERSION, decided_as: "student" },
  ]);

  await card.getByRole("button", { name: "Disattiva strumenti AI" }).click();
  await expect(card.getByRole("button", { name: "Attiva strumenti AI" })).toBeVisible();
  expect(fake.table("ai_consents")).toMatchObject([{ student_id: student.id, granted: false }]);
});

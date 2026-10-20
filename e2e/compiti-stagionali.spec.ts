import { test, expect } from "./support/test";
import { course as python, homework as normalHomework, lesson as pythonLesson, seedStudent, student } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Compiti stagionali (drizzle/migrations/0066_seasonal_homework.sql).
 * L'admin li gestisce in /admin/compiti-stagionali: un compito per corso per tema,
 * da inserire in una lezione, spostare e togliere (torna in archivio, lesson_id NULL).
 */

// Lunedì (prima della data reale: la sessione finta non deve risultare scaduta)
const TODAY = "2026-10-19";

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const scratch = {
  id: "c0000000-0000-4000-8000-000000000002",
  slug: "scratch",
  title: "Scratch",
  emoji: "🐱",
  is_visible: true,
  total_lessons: 3,
};

const scratchLessons = ["Il gatto che parla", "Animazioni", "Giochi con i cloni"].map((title, i) => ({
  id: `a0000000-0000-4000-8000-00000000010${i + 1}`,
  course_id: scratch.id,
  lesson_number: i + 1,
  title,
}));

const halloween = {
  id: "f0000000-0000-4000-8000-000000000001",
  name: "Halloween",
  emoji: "🎃",
  prompt: "Crea una mappa, degli oggetti o un gioco a tema Halloween",
  period_hint: "fine ottobre",
  sort_order: 1,
};
const natale = { ...halloween, id: "f0000000-0000-4000-8000-000000000002", name: "Natale", emoji: "🎄", prompt: "", period_hint: "dicembre", sort_order: 2 };

const scratchGroup = { id: "e3000000-0000-4000-8000-000000000001", course_id: scratch.id, title: "Scratch - Lunedì", status: "active" };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
});

test.describe("admin", () => {
  test.beforeEach(async ({ page, fake }) => {
    fake.addUser(admin);
    fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
    fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
    fake.seed("courses", [scratch, python]);
    fake.seed("lessons", [...scratchLessons, pythonLesson]);
    fake.seed("seasonal_themes", [natale, halloween]);
    fake.seed("student_groups", [scratchGroup]);
    // Il gruppo di Scratch ha fatto L2 oggi e fa L3 lunedì prossimo
    fake.seed("group_lesson_schedule", [
      { group_id: scratchGroup.id, lesson_number: 1, lesson_date: "2026-10-12" },
      { group_id: scratchGroup.id, lesson_number: 2, lesson_date: "2026-10-19" },
      { group_id: scratchGroup.id, lesson_number: 3, lesson_date: "2026-10-26" },
    ]);
    await fake.signInBeforeLoad(page, admin);
  });

  const seasonalRows = (fake: FakeSupabase) => fake.table("homework").filter((h) => h.seasonal_theme_id === halloween.id);
  const scratchRow = (fake: FakeSupabase) => seasonalRows(fake).find((h) => h.course_id === scratch.id)!;

  test("crea, personalizza, inserisce, sposta e toglie i compiti di un tema", async ({ page, fake }) => {
    await page.goto("/admin/compiti-stagionali");
    await expect(page.getByRole("heading", { name: "Compiti stagionali" })).toBeVisible();
    // Temi in ordine di stagione: Halloween è il primo
    await expect(page.getByRole("tab", { name: /Halloween/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(halloween.prompt)).toBeVisible();

    const scratchItem = page.getByRole("listitem", { name: "Scratch" });
    const pythonItem = page.getByRole("listitem", { name: "Python Base" });
    await expect(scratchItem.getByText("Da creare")).toBeVisible();
    await expect(pythonItem.getByText("Da creare")).toBeVisible();

    // Una bozza per ogni corso, in archivio, con la richiesta standard
    await page.getByRole("button", { name: "Crea bozze per tutti i corsi (2)" }).click();
    await expect(page.getByText("Create 2 bozze", { exact: true })).toBeVisible();
    await expect(scratchItem.getByText("In archivio")).toBeVisible();
    expect(seasonalRows(fake)).toHaveLength(2);
    expect(scratchRow(fake)).toMatchObject({
      lesson_id: null,
      title: "🎃 Missione Halloween",
      description: halloween.prompt,
      instructions: `<p>${halloween.prompt}</p>`,
    });

    // Personalizzazione con l'editor dei compiti
    await scratchItem.getByRole("link", { name: "Modifica Scratch" }).click();
    await expect(page.getByText("In archivio, non è in nessuna lezione")).toBeVisible();
    await expect(page.getByLabel("Titolo *")).toHaveValue("🎃 Missione Halloween");
    await page.getByLabel("Titolo *").fill("🎃 La zucca che salta");
    await page.getByRole("button", { name: "Salva Modifiche" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/compiti-stagionali\\?tema=${halloween.id}$`));
    expect(scratchRow(fake)).toMatchObject({ title: "🎃 La zucca che salta", lesson_id: null, course_id: scratch.id });

    // Anteprima come la vedono gli alunni, anche se non è in nessuna lezione
    await scratchItem.getByRole("link", { name: "Visualizza Scratch" }).click();
    await expect(page.getByRole("heading", { name: "🎃 La zucca che salta" })).toBeVisible();
    await expect(page.getByText("🎃 Missione Halloween", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Torna ai compiti" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/compiti-stagionali\\?tema=${halloween.id}$`));

    // Inserisci: proposta la prossima lezione del gruppo (L3), scelgo L2
    await scratchItem.getByRole("button", { name: "Inserisci Scratch" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Scratch - Lunedì: fatta L2 il 19/10 · prossima L3 il 26/10")).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveText("L3 · Giochi con i cloni");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "L2 · Animazioni" }).click();
    await dialog.getByLabel("Scadenza (facoltativa)").fill("2026-11-02");
    await dialog.getByRole("button", { name: "Inserisci", exact: true }).click();
    await expect(page.getByText("Compito inserito", { exact: true })).toBeVisible();
    await expect(scratchItem.getByText("In L2 · Animazioni")).toBeVisible();
    await expect(scratchItem.getByText("Scadenza 02/11")).toBeVisible();
    expect(scratchRow(fake).lesson_id).toBe(scratchLessons[1].id);

    // Sposta in L3
    await scratchItem.getByRole("button", { name: "Sposta Scratch" }).click();
    await expect(dialog.getByRole("combobox")).toHaveText("L2 · Animazioni");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "L3 · Giochi con i cloni" }).click();
    await dialog.getByRole("button", { name: "Sposta", exact: true }).click();
    await expect(scratchItem.getByText("In L3 · Giochi con i cloni")).toBeVisible();
    expect(scratchRow(fake).lesson_id).toBe(scratchLessons[2].id);

    // Togli: torna in archivio, il testo resta
    await scratchItem.getByRole("button", { name: "Togli Scratch" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Togli" }).click();
    await expect(scratchItem.getByText("In archivio")).toBeVisible();
    expect(scratchRow(fake)).toMatchObject({ lesson_id: null, title: "🎃 La zucca che salta" });

    // Inserisci in tutti i corsi: Scratch ha la lezione suggerita, Python (senza gruppi) "Non inserire"
    await page.getByRole("button", { name: "Inserisci in tutti i corsi" }).click();
    await expect(dialog.getByLabel("🐍 Python Base")).toHaveText("Non inserire");
    await expect(dialog.getByLabel("🐱 Scratch")).toHaveText("L3 · Giochi con i cloni");
    await dialog.getByRole("button", { name: "Inserisci in 1 corso" }).click();
    await expect(scratchItem.getByText("In L3 · Giochi con i cloni")).toBeVisible();
    await expect(pythonItem.getByText("In archivio")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Halloween/ })).toContainText("1");

    // Nella lista compiti della lezione: badge del tema e "Togli dalla lezione" invece del cestino
    await page.goto(`/admin/corsi/${scratch.id}/lezioni/${scratchLessons[2].id}/compiti`);
    await expect(page.getByRole("heading", { name: "🎃 La zucca che salta" })).toBeVisible();
    await expect(page.getByText("🎃 Missione Halloween", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: 'Togli "🎃 La zucca che salta" dalla lezione' }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Togli" }).click();
    await expect(page.getByText("Compito tolto dalla lezione", { exact: true })).toBeVisible();
    await expect(page.getByText("Nessun compito")).toBeVisible();
    expect(scratchRow(fake)).toMatchObject({ lesson_id: null });
    expect(seasonalRows(fake)).toHaveLength(2);
  });

  test("crea ed elimina un tema", async ({ page }) => {
    await page.goto("/admin/compiti-stagionali");
    await page.getByRole("button", { name: "Nuovo tema" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Emoji").fill("🐣");
    await dialog.getByLabel("Nome").fill("halloween");
    await dialog.getByRole("button", { name: "Crea tema" }).click();
    await expect(page.getByText('Esiste già un tema "halloween"', { exact: true })).toBeVisible();

    await dialog.getByLabel("Nome").fill("Pasqua");
    await dialog.getByLabel("Richiesta standard").fill("Crea una caccia alle uova");
    await dialog.getByRole("button", { name: "Crea tema" }).click();
    await expect(page.getByText("Tema creato", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Pasqua/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Crea una caccia alle uova")).toBeVisible();

    // Senza compiti si può eliminare
    await page.getByRole("button", { name: "Elimina il tema Pasqua" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Elimina" }).click();
    await expect(page.getByRole("tab", { name: /Pasqua/ })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Halloween/ })).toHaveAttribute("aria-selected", "true");
  });

  test("senza la migrazione mostra l'avviso", async ({ page }) => {
    await page.route("**/rest/v1/seasonal_themes**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.seasonal_themes' in the schema cache" }),
      }),
    );
    await page.goto("/admin/compiti-stagionali");
    await expect(page.getByText("Lovable deve applicare la migrazione 0066_seasonal_homework")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
  });
});

test("l'alunno vede il badge del tema sul compito stagionale", async ({ page, fake }) => {
  seedStudent(fake);
  fake.seed("seasonal_themes", [halloween]);
  fake.seed("homework", [
    {
      ...normalHomework,
      id: "d0000000-0000-4000-8000-000000000099",
      title: "Zucche e pipistrelli",
      seasonal_theme_id: halloween.id,
      course_id: python.id,
    },
  ]);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  // Il badge è nel titolo della card del compito stagionale, non in quello normale
  await expect(page.getByRole("heading", { name: "Zucche e pipistrelli 🎃 Missione Halloween" })).toBeVisible();
  await expect(page.getByRole("heading", { name: normalHomework.title, exact: true })).toBeVisible();
  await expect(page.getByText("🎃 Missione Halloween", { exact: true })).toHaveCount(1);
});

import { test, expect } from "./support/test";
import { codeTask, course, homework, lesson, parent, seedStudent, student } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Mappa delle competenze (DigComp): genitore, alunno e insegnante vedono il
 * livello di ogni argomento; l'insegnante lo conferma o lo cambia; l'admin
 * collega gli argomenti alle lezioni. I conteggi li fa la funzione SQL
 * student_skill_evidence (verificata in supabase/tests/rls/15_skill_map.sql):
 * qui il fake la sostituisce con righe fisse più le valutazioni salvate.
 */

const TODAY = "2026-10-16";

const teacher: FakeUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "marco.verdi@techland.test",
  password: "password-di-prova",
  fullName: "Marco Verdi",
};

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const group = { id: "e1000000-0000-4000-8000-000000000001", title: "Python Base - Venerdì", course_id: course.id, course };

const evidenceRow = (concept: string, counts: Partial<Record<string, unknown>>) => ({
  concept,
  lessons_tagged: 0,
  lessons_met: 0,
  lessons_completed: 0,
  homework_scored: 0,
  homework_avg: null,
  last_activity: null,
  course_ids: [course.id],
  teacher_level: null,
  teacher_note: null,
  assessed_at: null,
  assessed_by_name: null,
  ...counts,
});

/** Variabili Intermedio, Cicli e Pagine web Base, Condizioni da scoprire. */
const BASE_EVIDENCE = [
  evidenceRow("variabili", { lessons_tagged: 4, lessons_met: 3, lessons_completed: 2, homework_scored: 1, homework_avg: 85 }),
  evidenceRow("cicli", { lessons_tagged: 5, lessons_met: 2, lessons_completed: 1 }),
  evidenceRow("condizioni", { lessons_tagged: 3 }),
  evidenceRow("web", { lessons_tagged: 2, lessons_met: 1 }),
];

/** Come la funzione SQL: le valutazioni salvate entrano nelle righe (o ne aggiungono). */
function mockEvidence(fake: FakeSupabase) {
  fake.rpc("student_skill_evidence", (args, { fake }) => {
    const { p_student_id } = args as { p_student_id: string };
    if (p_student_id !== student.id) return [];
    const rows = BASE_EVIDENCE.map((r) => ({ ...r }));
    for (const a of fake.table("student_skill_assessments").filter((a) => a.student_id === student.id)) {
      let row = rows.find((r) => r.concept === a.concept);
      if (!row) rows.push((row = evidenceRow(a.concept as string, { course_ids: [] })));
      Object.assign(row, { teacher_level: a.level, teacher_note: a.note, assessed_at: `${TODAY}T18:00:00Z`, assessed_by_name: teacher.fullName });
    }
    return rows;
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T18:00:00+02:00`));
});

test.describe("genitore", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  function seedFamily(fake: FakeSupabase) {
    fake.addUser(parent);
    fake.seed("profiles", [
      { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
      { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 340, avatar_id: 2, lesson_balance: 2 },
    ]);
    fake.seed("courses", [course]);
    fake.seed("group_students", [{ group_id: group.id, student_id: student.id, group }]);
    fake.seed("student_groups", [{ id: group.id, course_id: course.id, title: group.title }]);
  }

  test("apre la sezione Competenze dal link e legge il perché di un livello", async ({ page, fake }) => {
    seedFamily(fake);
    mockEvidence(fake);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata#competenze");

    await expect(page.getByRole("button", { name: /Competenze.*3 su 4 avviate/ })).toBeVisible();
    const map = page.getByTestId("parent-skill-map");
    await expect(map.getByText("Cosa sa fare Luca con il coding", { exact: false })).toBeVisible();

    // Raggruppate per competenza DigComp, con il livello della competenza
    await expect(map.getByRole("heading", { name: "Programmazione" })).toBeVisible();
    await expect(map.getByTestId("digcomp-3.4-level")).toContainText("Base");
    await expect(map.getByRole("heading", { name: "Sviluppare contenuti digitali" })).toBeVisible();

    const variabili = map.getByTestId("skill-variabili");
    await expect(variabili).toContainText("Intermedio · DigComp 3–4");
    await expect(variabili.getByRole("img", { name: "Livello Intermedio (2 su 3)" })).toBeVisible();
    await expect(map.getByTestId("skill-condizioni")).toContainText("Da scoprire");
    // Argomenti fuori dai suoi corsi: non compaiono
    await expect(map.getByTestId("skill-oggetti")).toHaveCount(0);

    await variabili.getByRole("button", { name: /Perché/ }).click();
    const popover = page.getByRole("dialog");
    await expect(popover).toContainText("3 lezioni fatte su 4 dedicate a questo argomento, 2 completate sulla piattaforma, 1 compito valutato (media 85).");
    await expect(popover).toContainText("Per arrivare al livello Avanzato: completare ancora 2 lezioni sulla piattaforma e avere 1 altro compito valutato.");
    await expect(map.getByText("non è una certificazione", { exact: false })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBe(390);
  });

  test("senza lezioni collegate la sezione non c'è", async ({ page, fake }) => {
    seedFamily(fake);
    fake.rpc("student_skill_evidence", () => []);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(page.getByRole("button", { name: /Calendario lezioni/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Competenze/ })).toHaveCount(0);
  });
});

test("l'alunno vede la propria mappa con le frasi per lui", async ({ page, fake }) => {
  seedStudent(fake);
  mockEvidence(fake);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  const card = page.getByTestId("skill-map-card-student");
  await expect(card.getByText("La mia mappa delle competenze")).toBeVisible();
  await card.getByTestId("skill-variabili").getByRole("button", { name: /Perché/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Lo usi da solo per risolvere problemi.");
  // Niente pulsante per valutarsi da solo
  await expect(card.getByRole("button", { name: /Valuta/ })).toHaveCount(0);
});

test("l'insegnante conferma un livello e poi torna al calcolo automatico", async ({ page, fake }) => {
  fake.addUser(teacher);
  fake.addUser(student);
  fake.seed("profiles", [
    { id: teacher.id, full_name: teacher.fullName, role: "parent", parent_id: null },
    { id: student.id, full_name: student.fullName, role: "student", parent_id: null, total_points: 120, avatar_id: 1, lesson_balance: 4, created_at: "2026-09-01T00:00:00Z" },
  ]);
  fake.seed("user_roles", [{ user_id: teacher.id, role: "teacher" }]);
  fake.seed("courses", [course]);
  fake.seed("student_groups", [{ id: group.id, course_id: course.id, title: group.title, teacher_id: teacher.id }]);
  fake.seed("group_students", [{
    id: "f1000000-0000-4000-8000-000000000001", group_id: group.id, student_id: student.id,
    student_groups: { title: group.title, course_id: course.id, courses: { title: course.title, emoji: course.emoji } },
  }]);
  mockEvidence(fake);
  await fake.signInBeforeLoad(page, teacher);
  await page.goto(`/insegnante/studente/${student.id}`);

  const card = page.getByTestId("skill-map-card-teacher");
  await expect(card.getByText("Mappa delle competenze")).toBeVisible();
  // Gli argomenti senza lezioni collegate restano valutabili, in una riga a parte
  await expect(card.getByTestId("skill-oggetti")).toHaveCount(0);
  await expect(card.getByTestId("skill-map-others").getByRole("button", { name: "Valuta Oggetti e classi" })).toBeVisible();

  const cicli = card.getByTestId("skill-cicli");
  await expect(cicli).toContainText("Base · DigComp 1–2");
  await cicli.getByRole("button", { name: "Valuta Cicli e ripetizioni" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Calcolo automatico: Base.");
  await dialog.getByLabel(/^Intermedio/).check();
  await dialog.getByLabel("Nota per lo studente e la famiglia (facoltativa)").fill("Usa i cicli anche nei giochi liberi.");
  await dialog.getByRole("button", { name: "Salva" }).click();

  await expect(page.getByText("Livello salvato", { exact: true })).toBeVisible();
  await expect(cicli).toContainText("Intermedio · DigComp 3–4");
  await expect(cicli).toContainText("Confermato dall’insegnante");
  expect(fake.table("student_skill_assessments")).toEqual([
    expect.objectContaining({ student_id: student.id, concept: "cicli", level: 2, note: "Usa i cicli anche nei giochi liberi.", assessed_by: teacher.id }),
  ]);

  await cicli.getByRole("button", { name: "Valuta Cicli e ripetizioni" }).click();
  await dialog.getByRole("button", { name: "Torna al calcolo automatico" }).click();
  await expect(cicli).toContainText("Base · DigComp 1–2");
  await expect(cicli).not.toContainText("Confermato");
  expect(fake.table("student_skill_assessments")).toEqual([]);
});

test("l'admin collega le competenze a una lezione partendo dai suggerimenti", async ({ page, fake }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("courses", [course]);
  fake.seed("lessons", [{ ...lesson, objective: "far ripetere un saluto al computer", concepts: [] }]);
  fake.seed("lesson_tasks", [{ ...codeTask, default_python_code: 'for i in range(3):\n    print("Ciao")\n' }]);
  fake.seed("homework", [{ ...homework, instructions: "<p>Chiedi il nome e salvalo in una variabile.</p>" }]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto(`/admin/corsi/${course.id}/lezioni/${lesson.id}/modifica`);

  // Suggeriti dal codice del task (for) e dal testo del compito (variabile)
  const suggestions = page.getByTestId("concept-suggestions");
  await expect(suggestions.getByRole("button", { name: "+ Variabili" })).toBeVisible();
  await expect(suggestions.getByRole("button", { name: "+ Cicli e ripetizioni" })).toBeVisible();

  await suggestions.getByRole("button", { name: "+ Cicli e ripetizioni" }).click();
  await expect(page.getByRole("button", { name: "🔁 Cicli e ripetizioni" })).toHaveAttribute("aria-pressed", "true");
  await expect(suggestions.getByRole("button", { name: "+ Cicli e ripetizioni" })).toHaveCount(0);

  await page.getByRole("button", { name: "Salva Modifiche" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/corsi/${course.id}/lezioni$`));
  expect(fake.table("lessons").find((l) => l.id === lesson.id)?.concepts).toEqual(["cicli"]);

  // L'elenco lezioni mostra cosa copre il corso
  await expect(page.getByTestId("course-concept-coverage")).toContainText("🔁 Cicli e ripetizioni (1)");
});

import { test, expect } from "./support/test";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";
import { course, lesson } from "./support/seed";

/**
 * Anteprima delle lezioni "come gli studenti":
 * - admin: schede Modifica / Visualizza nelle pagine dei contenuti
 * - insegnante: interruttore Insegnante / Studente nella vista lezione
 */

const admin: FakeUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Anna Admin",
};

const teacher: FakeUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "marco.verdi@techland.test",
  password: "password-di-prova",
  fullName: "Marco Verdi",
};

const visibleTask = {
  id: "b0000000-0000-4000-8000-000000000011",
  lesson_id: lesson.id,
  task_number: 1,
  title: "Cos'è un programma",
  description: null,
  content: "<p>Un programma è una lista di istruzioni.</p>",
  content_type: "text",
  is_visible: true,
  points_reward: 10,
  attachments: [],
};

const hiddenTask = {
  ...visibleTask,
  id: "b0000000-0000-4000-8000-000000000012",
  task_number: 2,
  title: "Soluzioni per la classe",
  content: "<p>Solo per l'insegnante.</p>",
  is_visible: false,
};

function seedCourse(fake: FakeSupabase) {
  fake.seed("courses", [course]);
  fake.seed("lessons", [lesson]);
  fake.seed("lesson_tasks", [visibleTask, hiddenTask]);
}

const taskNavigation = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Navigazione task" }).locator("visible=true");

test.describe("admin", () => {
  test.beforeEach(async ({ fake, page }) => {
    fake.addUser(admin);
    fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName }]);
    fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
    seedCourse(fake);
    await fake.signInBeforeLoad(page, admin);
  });

  test("Visualizza mostra la lezione come gli studenti, Modifica torna all'editor", async ({ page }) => {
    await page.goto(`/admin/corsi/${course.id}/lezioni/${lesson.id}/task`);
    await expect(page.getByRole("tab", { name: "Modifica" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Visualizza" }).click();
    await expect(page).toHaveURL(`/admin/corsi/${course.id}/anteprima/lezione/1/task/1`);
    await expect(page.getByText("Un programma è una lista di istruzioni.")).toBeVisible();
    // Il task nascosto non compare: come per lo studente c'è un solo task
    await expect(taskNavigation(page)).toContainText("Task 1 di 1");
    await expect(page.getByText(hiddenTask.title)).toHaveCount(0);

    await page.getByRole("tab", { name: "Modifica" }).click();
    await expect(page).toHaveURL(`/admin/corsi/${course.id}/lezioni/${lesson.id}/task/${visibleTask.id}/modifica`);
  });

  test("dall'editor Visualizza apre il task aperto", async ({ page }) => {
    await page.goto(`/admin/corsi/${course.id}/lezioni/${lesson.id}/task/${visibleTask.id}/modifica`);
    await page.getByRole("tab", { name: "Visualizza" }).click();
    await expect(page).toHaveURL(`/admin/corsi/${course.id}/anteprima/lezione/1/task/1`);
  });

  test("un task nascosto si può vedere in anteprima, con un avviso", async ({ page }) => {
    await page.goto(`/admin/corsi/${course.id}/anteprima/lezione/1/task/2`);
    await expect(page.getByText("Solo per l'insegnante.")).toBeVisible();
    await expect(page.getByText("Task nascosto: gli studenti non lo vedono")).toBeVisible();
  });
});

test.describe("insegnante", () => {
  test.beforeEach(async ({ fake, page }) => {
    fake.addUser(teacher);
    fake.seed("profiles", [{ id: teacher.id, full_name: teacher.fullName }]);
    fake.seed("user_roles", [{ user_id: teacher.id, role: "teacher" }]);
    fake.seed("teacher_courses", [{ teacher_id: teacher.id, course_id: course.id }]);
    seedCourse(fake);
    await fake.signInBeforeLoad(page, teacher);
  });

  test("passa dalla vista insegnante a quella dello studente", async ({ page }) => {
    await page.goto(`/insegnante/corso/${course.slug}/lezione/1/task/1`);
    await expect(page.getByRole("tab", { name: "Insegnante" })).toHaveAttribute("aria-selected", "true");
    await expect(taskNavigation(page)).toContainText("Task 1 di 2");

    await page.getByRole("tab", { name: "Studente" }).click();
    await expect(taskNavigation(page)).toContainText("Task 1 di 1");

    // La scelta resta passando ad altre pagine
    await page.reload();
    await expect(page.getByRole("tab", { name: "Studente" })).toHaveAttribute("aria-selected", "true");
    await expect(taskNavigation(page)).toContainText("Task 1 di 1");
  });
});

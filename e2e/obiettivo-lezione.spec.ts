import { test, expect } from "./support/test";
import { codeTask, course, lesson, seedStudent, student } from "./support/seed";

/**
 * Obiettivo della lezione: all'inizio il ragazzo legge "Oggi imparerai a…",
 * sui task successivi resta una riga compatta nell'intestazione.
 */

const lessonUrl = `/area-riservata/corso/${course.id}/lezione/1`;

const secondTask = {
  ...codeTask,
  id: "b0000000-0000-4000-8000-000000000002",
  task_number: 2,
  title: "Variabili",
  description: "Salva un valore",
};

test.beforeEach(async ({ fake, page }) => {
  seedStudent(fake);
  fake.seed("lesson_tasks", [secondTask]);
  await fake.signInBeforeLoad(page, student);
});

test("l'obiettivo è in evidenza sul primo task e resta nell'intestazione dopo", async ({ page, fake }) => {
  fake.table("lessons").find((l) => l.id === lesson.id)!.objective = "usare print per far parlare il computer";

  await page.goto(`${lessonUrl}/task/1`);
  const banner = page.getByTestId("lesson-objective-banner");
  await expect(banner).toHaveText("🎯Oggi imparerai a usare print per far parlare il computer.");
  await expect(page.getByTestId("lesson-objective-inline")).toHaveCount(0);

  await page.goto(`${lessonUrl}/task/2`);
  await expect(page.getByText(secondTask.title).first()).toBeVisible();
  await expect(page.getByTestId("lesson-objective-inline").locator("visible=true")).toHaveText(/Oggi imparerai a usare print per far parlare il computer\./);
  await expect(page.getByTestId("lesson-objective-banner")).toHaveCount(0);
});

test("senza obiettivo non compare nulla", async ({ page }) => {
  await page.goto(`${lessonUrl}/task/1`);
  await expect(page.getByText(codeTask.title).first()).toBeVisible();
  await expect(page.getByTestId("lesson-objective-banner")).toHaveCount(0);
  await expect(page.getByTestId("lesson-objective-inline")).toHaveCount(0);
});

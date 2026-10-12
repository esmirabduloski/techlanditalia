import { test, expect } from "./support/test";
import { homework, seedStudent, student } from "./support/seed";

/** Consegna del compito: il lavoro dell'alunno deve arrivare all'insegnante, completo. */

const homeworkUrl = `/area-riservata/compito/${homework.id}`;

test.beforeEach(async ({ fake, page }) => {
  seedStudent(fake);
  await fake.signInBeforeLoad(page, student);
  // Pyodide non serve per consegnare: niente download da 10 MB in questi test.
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
});

test("INVIA consegna il codice appena scritto, anche prima dell'autosave", async ({ page, fake }) => {
  await page.goto(homeworkUrl);
  await expect(page.getByRole("heading", { name: homework.title }).first()).toBeVisible();
  await expect(page.getByText("Da fare")).toBeVisible();

  const code = "a = 2\nb = 3\nprint(a + b)";
  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill(code);
  // Click subito: l'autosave (3 s) non è ancora partito, deve pensarci flushCodeDrafts
  await page.getByRole("button", { name: "INVIA" }).click();

  await expect(page.getByText("Compito inviato! 🎉", { exact: true })).toBeVisible();
  await expect(page.getByText("In revisione")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aggiorna consegna" })).toBeVisible();

  const submissions = fake.table("homework_submissions");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    homework_id: homework.id,
    student_id: student.id,
    status: "pending",
    notes: `[CODE]\n${code}`,
    file_type: "text/code",
  });
});

test("una seconda consegna aggiorna quella esistente invece di duplicarla", async ({ page, fake }) => {
  fake.seed("homework_submissions", [
    { homework_id: homework.id, student_id: student.id, status: "rejected", notes: "[CODE]\nprint(5)", teacher_feedback: "Usa le variabili", submitted_at: "2026-10-01T10:00:00Z", points_earned: 0 },
  ]);

  await page.goto(homeworkUrl);
  await expect(page.getByText("Da rivedere")).toBeVisible();
  await expect(page.getByText("Usa le variabili")).toBeVisible();

  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill("x = 2\ny = 3\nprint(x + y)");
  await page.getByRole("button", { name: "Aggiorna consegna" }).click();

  await expect(page.getByText("In revisione")).toBeVisible();
  const submissions = fake.table("homework_submissions");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ status: "pending", notes: "[CODE]\nx = 2\ny = 3\nprint(x + y)" });
});

test("non si consegna un compito vuoto", async ({ page, fake }) => {
  await page.goto(homeworkUrl);
  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill("   ");
  await page.getByRole("button", { name: "INVIA" }).click();

  await expect(page.getByText("Codice richiesto", { exact: true })).toBeVisible();
  expect(fake.table("homework_submissions")).toHaveLength(0);
});

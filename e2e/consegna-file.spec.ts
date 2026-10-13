import { test, expect } from "./support/test";
import { homework, seedStudent, student } from "./support/seed";

/** Consegna con file (pagina compito-dettaglio): l'aggiornamento deve arrivare davvero al database. */

const homeworkUrl = `/area-riservata/compito-dettaglio/${homework.id}`;

test.beforeEach(async ({ fake, page }) => {
  seedStudent(fake);
  fake.fn("validate-file-upload", () => ({ body: { valid: true } }));
  await fake.signInBeforeLoad(page, student);
});

async function uploadAndSubmit(page: import("@playwright/test").Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "disegno.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await expect(page.getByText("File caricato", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aggiorna consegna" }).click();
}

test("un nuovo file aggiorna la consegna rimandata indietro", async ({ page, fake }) => {
  fake.seed("homework_submissions", [
    { homework_id: homework.id, student_id: student.id, status: "reviewed", file_url: `${student.id}/vecchio.png`, file_name: "vecchio.png", file_type: "image/png", teacher_feedback: "Manca il titolo", submitted_at: "2026-10-01T10:00:00Z", points_earned: 0 },
  ]);

  await page.goto(homeworkUrl);
  await expect(page.getByText("Manca il titolo")).toBeVisible();
  await uploadAndSubmit(page);

  await expect(page.getByText("Compito inviato!", { exact: true })).toBeVisible();
  const submissions = fake.table("homework_submissions");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ status: "pending", file_name: "disegno.png", file_type: "image/png", teacher_feedback: "Manca il titolo" });
  expect(submissions[0].file_url).toMatch(new RegExp(`^${student.id}/disegno-.*\\.png$`));
});

test("una consegna già valutata non si riscrive e lo studente lo vede", async ({ page, fake }) => {
  fake.seed("homework_submissions", [
    { homework_id: homework.id, student_id: student.id, status: "graded", grade: 80, file_url: `${student.id}/vecchio.png`, file_name: "vecchio.png", file_type: "image/png", submitted_at: "2026-10-01T10:00:00Z", points_earned: 30 },
  ]);

  await page.goto(homeworkUrl);
  await uploadAndSubmit(page);

  await expect(page.getByText("Il compito è già stato valutato: non puoi più modificare la consegna.", { exact: true })).toBeVisible();
  expect(fake.table("homework_submissions")[0]).toMatchObject({ status: "graded", file_name: "vecchio.png" });
});

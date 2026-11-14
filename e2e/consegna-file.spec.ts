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

  // Il modulo di consegna sparisce: lo studente vede la valutazione, non può ricaricare.
  await expect(page.getByText("Compito valutato!", { exact: true })).toBeVisible();
  await expect(page.getByText("Hai guadagnato 30 punti")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aggiorna consegna" })).toHaveCount(0);
  expect(fake.table("homework_submissions")[0]).toMatchObject({ status: "graded", file_name: "vecchio.png" });
});

test("si consegna un gioco Scratch .sb3, anche se il browser non ne conosce il tipo", async ({ page, fake }) => {
  await page.goto(homeworkUrl);
  await expect(page.getByText("Trascina un file qui o")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "gioco.sb3",
    mimeType: "", // Chrome e Safari non hanno un tipo per .sb3
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]), // un .sb3 è uno ZIP
  });
  await expect(page.getByText("File caricato", { exact: true })).toBeVisible();
  expect(fake.callsTo("validate-file-upload")[0].body).toMatchObject({ fileName: "gioco.sb3", mimeType: "application/x.scratch.sb3" });

  await page.getByRole("button", { name: "Invia compito" }).click();
  await expect(page.getByText("Compito inviato!", { exact: true })).toBeVisible();

  const submissions = fake.table("homework_submissions");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ status: "pending", file_name: "gioco.sb3", file_type: "application/x.scratch.sb3" });
  expect(submissions[0].file_url).toMatch(new RegExp(`^${student.id}/gioco-.*\\.sb3$`));
});

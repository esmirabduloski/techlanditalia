import { test, expect } from "./support/test";
import { codeTask, course, seedStudent, student } from "./support/seed";

/**
 * Esecuzione del codice nelle lezioni: è il prodotto che il genitore paga.
 * Usa Pyodide vero da jsDelivr (la stessa versione del sito): se la CDN, la CSP
 * o il caricamento si rompono, questo test lo vede.
 */

const taskUrl = `/area-riservata/corso/${course.id}/lezione/1/task/1`;

test.beforeEach(async ({ fake, page }) => {
  seedStudent(fake);
  await fake.signInBeforeLoad(page, student);
});

test("l'alunno scrive Python, lo esegue e vede l'output", async ({ page, fake }) => {
  test.slow(); // primo download di Pyodide (~10 MB)

  await page.goto(taskUrl);
  await expect(page.getByText(codeTask.title).first()).toBeVisible();

  const run = page.getByRole("button", { name: "Esegui" });
  await expect(run).toBeEnabled({ timeout: 90_000 });

  const editor = page.getByPlaceholder("Scrivi il tuo codice Python...");
  await expect(editor).toHaveValue(codeTask.default_python_code);
  await editor.fill('nomi = ["Luca", "Sara"]\nfor n in nomi:\n    print(f"Ciao {n}!")\nprint(sum(range(5)))');
  await run.click();

  const output = page.locator("pre").filter({ hasText: "Ciao Luca!" });
  await expect(output).toHaveText("Ciao Luca!\nCiao Sara!\n10\n");

  // Gli errori Python arrivano all'alunno invece di bloccare la pagina
  await editor.fill("print(1/0)");
  await run.click();
  await expect(page.locator("pre").filter({ hasText: "ZeroDivisionError" })).toBeVisible();

  // Il codice viene salvato come bozza dello studente (autosave dopo 3 s)
  await expect
    .poll(() => fake.table("student_code_drafts").find((d) => d.task_id === codeTask.id)?.content, { timeout: 10_000 })
    .toBe("print(1/0)");
  expect(fake.table("student_code_drafts")[0]).toMatchObject({ student_id: student.id, code_type: "python" });
});

test("riaprendo il task ritrova il codice salvato", async ({ page, fake }) => {
  fake.seed("student_code_drafts", [
    { student_id: student.id, task_id: codeTask.id, code_type: "python", content: 'print("bozza salvata")', updated_at: "2026-10-01T10:00:00Z" },
  ]);

  await page.goto(taskUrl);
  await expect(page.getByPlaceholder("Scrivi il tuo codice Python...")).toHaveValue('print("bozza salvata")');
});

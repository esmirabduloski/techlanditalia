import { test, expect } from "./support/test";
import { codeTask, course, homework, lesson, seedStudent, student } from "./support/seed";

/**
 * Correzione automatica con casi di prova: lo studente preme "Verifica" e sa
 * subito se il codice funziona; alla consegna la % di test superati diventa il
 * voto proposto per l'insegnante. Python usa Pyodide vero (in un Web Worker).
 */

const taskUrl = `/area-riservata/corso/${course.id}/lezione/1/task/1`;
const homeworkUrl = `/area-riservata/compito/${homework.id}`;

const pythonTests = [
  { id: "stampa", name: "Stampa la somma di 2 e 3", kind: "io", expected: "5", match: "trim", hint: "Stampa solo il numero" },
  { id: "funzione", name: "La funzione somma", kind: "assert", code: "assert somma(10, 5) == 15" },
];

test.beforeEach(async ({ fake, page }) => {
  seedStudent(fake);
  await fake.signInBeforeLoad(page, student);
});

test("Python: Verifica mostra i test superati e sblocca la task successiva", async ({ page, fake }) => {
  test.slow(); // download di Pyodide nel worker

  Object.assign(fake.table("lesson_tasks")[0], { test_cases: pythonTests, tests_required: true });
  fake.seed("lesson_tasks", [{ ...codeTask, id: "b0000000-0000-4000-8000-000000000002", task_number: 2, title: "Secondo esercizio", test_cases: [] }]);
  const completed: unknown[] = [];
  fake.rpc("complete_task", (args) => { completed.push(args); return { success: true }; });

  await page.goto(taskUrl);
  await expect(page.getByText(codeTask.title).first()).toBeVisible();

  const next = page.getByRole("button", { name: "Task successivo" });
  await expect(next).toBeDisabled();
  await expect(page.getByText("Supera tutti i test per continuare")).toBeVisible();

  const editor = page.getByPlaceholder("Scrivi il tuo codice Python...");
  await editor.fill('def somma(a, b):\n    return a + b\n\nprint("risultato", somma(2, 3))');
  await page.getByRole("button", { name: "Verifica" }).first().click();

  const panel = page.getByTestId("test-cases-panel");
  await expect(panel.getByText("1/2 test superati")).toBeVisible({ timeout: 90_000 });
  // Il test fallito spiega cosa era atteso e cosa è uscito
  await expect(panel.getByText("risultato 5")).toBeVisible();
  await expect(panel.getByText("💡 Stampa solo il numero")).toBeVisible();
  await expect(next).toBeDisabled();

  await editor.fill("def somma(a, b):\n    return a + b\n\nprint(somma(2, 3))");
  await page.getByRole("button", { name: "Verifica" }).first().click();
  await expect(panel.getByText("2/2 test superati")).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Tutti i test superati")).toBeVisible();

  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/\/task\/2$/);
  expect(completed).toEqual([{ _task_id: codeTask.id }]);
});

test("Python: un ciclo infinito non blocca la pagina", async ({ page, fake }) => {
  test.slow();
  Object.assign(fake.table("lesson_tasks")[0], { test_cases: [pythonTests[0]] });

  await page.goto(taskUrl);
  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill("while True:\n    pass");
  await page.getByRole("button", { name: "Verifica" }).first().click();

  const panel = page.getByTestId("test-cases-panel");
  await expect(panel.getByText("Tempo scaduto (ciclo infinito?)")).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByText("0/1 test superati")).toBeVisible();
  // La pagina risponde ancora: si può correggere e riverificare
  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill("print(5)");
  await page.getByRole("button", { name: "Verifica" }).first().click();
  await expect(panel.getByText("1/1 test superati")).toBeVisible({ timeout: 90_000 });
});

test("Python: un errore nei test è spiegato in italiano", async ({ page, fake }) => {
  test.slow();
  Object.assign(fake.table("lesson_tasks")[0], { test_cases: pythonTests });

  await page.goto(taskUrl);
  const editor = page.getByPlaceholder("Scrivi il tuo codice Python...");
  await editor.fill('x = int("ciao")');
  await page.getByRole("button", { name: "Verifica" }).first().click();

  const panel = page.getByTestId("test-cases-panel");
  await expect(panel.getByText("0/2 test superati")).toBeVisible({ timeout: 90_000 });
  const errori = panel.getByTestId("friendly-error");
  await expect(errori.first()).toContainText("Questo testo non è un numero · riga 1");

  // Il codice gira ma non definisce somma(): l'errore è nel codice del test, quindi senza riga
  await editor.fill("print(5)");
  await page.getByRole("button", { name: "Verifica" }).first().click();
  await expect(panel.getByText("1/2 test superati")).toBeVisible({ timeout: 30_000 });
  await expect(errori).toHaveCount(1);
  await expect(errori).toContainText("Hai usato somma, ma Python non sa ancora cos'è.");
  await expect(errori).not.toContainText("riga");
});

test("Web: la consegna salva il voto proposto dai test", async ({ page, fake }) => {
  // Pyodide non serve per un compito Web
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
  const webCourse = { ...course, id: "c0000000-0000-4000-8000-000000000002", slug: "web-development", title: "Web Development", emoji: "🌐" };
  Object.assign(fake.table("homework")[0], {
    default_html_code: "<h1>La mia pagina</h1>\n<ul><li>HTML</li></ul>",
    default_css_code: "h1 { color: red; }",
    default_js_code: "",
    test_cases: [
      { id: "titolo", name: "C'è un titolo", kind: "dom-text", selector: "h1", contains: "la mia pagina" },
      { id: "colore", name: "Il titolo è rosso", kind: "css", selector: "h1", property: "color", value: "red" },
      { id: "lista", name: "Lista con 3 elementi", kind: "dom-count", selector: "li", min: 3 },
    ],
    lessons: { id: lesson.id, title: lesson.title, lesson_number: 1, courses: { id: webCourse.id, title: webCourse.title, emoji: webCourse.emoji, slug: webCourse.slug } },
  });

  await page.goto(homeworkUrl);
  await page.getByRole("button", { name: "Verifica" }).first().click();
  const panel = page.getByTestId("test-cases-panel");
  await expect(panel.getByText("2/3 test superati")).toBeVisible();
  await expect(panel.getByText("Trovato: 1 elementi")).toBeVisible();

  await page.getByRole("button", { name: "INVIA" }).click();
  await expect(page.getByText("Test superati: 2/3 · voto proposto 67/100, in attesa di conferma dell'insegnante", { exact: true })).toBeVisible();

  const submissions = fake.table("homework_submissions");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ status: "pending", auto_score: 67 });
  expect(submissions[0].test_results).toEqual([
    expect.objectContaining({ id: "titolo", passed: true }),
    expect.objectContaining({ id: "colore", passed: true }),
    expect.objectContaining({ id: "lista", passed: false }),
  ]);
  await expect(page.getByText("Voto proposto dai test:")).toBeVisible();
});

test("una consegna già valutata non si può riconsegnare", async ({ page, fake }) => {
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
  fake.seed("homework_submissions", [
    { homework_id: homework.id, student_id: student.id, status: "graded", grade: 80, notes: "[CODE]\nprint(5)", teacher_feedback: "Bravo", submitted_at: "2026-10-01T10:00:00Z", points_earned: 24 },
  ]);

  await page.goto(homeworkUrl);
  await expect(page.getByText("Valutato · 80/100")).toBeVisible();
  await expect(page.getByText("Voto: 80/100 · Punti guadagnati: 24")).toBeVisible();
  await expect(page.getByRole("button", { name: "Valutato" })).toBeDisabled();
});

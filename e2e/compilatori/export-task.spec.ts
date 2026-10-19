import { readFile } from "node:fs/promises";
import { test, expect } from "../support/test";
import type { FakeUser } from "../support/fakeSupabase";

/**
 * Admin → Backup → "Esporta task per i test": scarica task e compiti con codice
 * (e2e/compilatori/task-reali.json) per provare ogni aggiornamento dei
 * compilatori sui task veri. Solo contenuti dei corsi, nessun dato di alunni.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const corso = (slug: string, lesson_number: number) => ({ lesson_number, courses: { slug } });

test("l'admin scarica task e compiti con codice per i test dei compilatori", async ({ page, fake }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("lesson_tasks", [
    { id: "t-python", title: "Somma", task_number: 1, content_type: "mixed", is_visible: true, python_env: "standard", default_python_code: "print(2 + 3)", test_cases: [{ id: "a", kind: "io", expected: "5" }], attachments: [], lessons: corso("python-base", 2) },
    { id: "t-turtle", title: "Quadrato", task_number: 2, content_type: "mixed", is_visible: false, python_env: null, default_python_code: "import turtle", test_cases: [], attachments: null, lessons: corso("python-base", 2) },
    { id: "t-quiz", title: "Quiz", task_number: 3, content_type: "quiz", is_visible: true, test_cases: [], lessons: corso("python-base", 2) },
    {
      id: "t-web", title: "Pagina", task_number: 1, content_type: "mixed", is_visible: true, default_html_code: "<h1>Ciao</h1>", test_cases: [], lessons: corso("web-development", 1),
      attachments: [{ name: "stile.css", url: "https://allegati.e2e.test/stile.css", type: "css" }, { name: "logo.png", url: "https://allegati.e2e.test/logo.png", type: "image" }],
    },
  ]);
  fake.seed("homework", [
    { id: "h-pgzero", title: "Gioco", python_env: "pgzero", default_python_code: "WIDTH = 400", replit_url: "https://replit.com/@x/y", preview_only: false, test_cases: [], lessons: corso("python-base", 3) },
    { id: "h-scratch", title: "Scratch", default_python_code: null, test_cases: [], lessons: corso("scratch-junior", 1) },
  ]);
  await page.route("https://allegati.e2e.test/**", (route) =>
    route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "text/css" }, body: "h1 { color: red; }" }));
  await fake.signInBeforeLoad(page, admin);

  await page.goto("/admin/backup");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta task per i test" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("task-reali.json");
  await expect(page.getByText("Esportati 4 task e compiti", { exact: true })).toBeVisible();

  const corpus = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(corpus.versioni).toEqual({ pyodide: expect.any(String), skulpt: expect.any(String) });
  expect(corpus.task.map((t: { tipo: string; id: string; compilatore: string }) => `${t.tipo}:${t.id}:${t.compilatore}`)).toEqual([
    "task:t-python:python",
    "task:t-turtle:turtle",
    "compito:h-pgzero:pgzero",
    "task:t-web:web",
  ]);
  expect(corpus.task[0]).toMatchObject({ corso: "python-base", lezione: 2, numero: 1, default_python_code: "print(2 + 3)", test_cases: [{ id: "a", kind: "io", expected: "5" }] });
  expect(corpus.task[1]).toMatchObject({ visibile: false });
  expect(corpus.task[2]).toMatchObject({ replit_url: "https://replit.com/@x/y", numero: null });
  expect(corpus.task[3].allegati).toEqual([
    { name: "stile.css", url: "https://allegati.e2e.test/stile.css", type: "css", contenuto: "h1 { color: red; }" },
    { name: "logo.png", url: "https://allegati.e2e.test/logo.png", type: "image" },
  ]);
});

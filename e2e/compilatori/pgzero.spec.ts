import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { compitoUrl, impostaCodice, preparaAlunno, taskUrl } from "./apri";
import { aspettaColore, dimensioniGioco, finestra, pngPieno } from "./gioco";
import { codeTask, student } from "../support/seed";

/**
 * Pygame Zero nel sito: Pyodide con pygame-ce e pgzero veri (le stesse versioni
 * del sito, src/lib/runtimes.ts). Il gioco si apre nella finestra del compilatore,
 * risponde a tastiera e mouse, usa immagini della libreria e degli allegati.
 * Copia per Replit e "Apri Replit" restano come alternativa.
 */

const GIOCO = [
  "WIDTH = 400",
  "HEIGHT = 300",
  "x = 200",
  "",
  "def draw():",
  '    screen.fill("darkblue")',
  '    screen.draw.filled_circle((x, 150), 20, "yellow")',
  "",
  "def update():",
  "    global x",
  "    if keyboard.right:",
  "        x += 5",
  "",
].join("\n");

const BLU = [0, 0, 139];
const GIALLO = [255, 255, 0];

test.beforeEach(async ({ fake, page }) => {
  // Pygame Zero non usa il Pyodide di Python
  await page.route("https://cdn.jsdelivr.net/pyodide/v0.24.1/**", (route) => route.abort());
  await preparaAlunno(page, fake, "python-base", {
    python_env: "pgzero",
    default_python_code: GIOCO,
    replit_url: "https://replit.com/@techland/gioco-astronave",
  });
  // window.open registra l'URL invece di aprire Replit
  await page.addInitScript(() => {
    (window as unknown as { aperti: string[] }).aperti = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { aperti: string[] }).aperti.push(String(url));
      return null;
    };
  });
});

async function apriGioco(page: Page, url = taskUrl) {
  await page.goto(url);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 120_000 });
  return page.getByRole("textbox", { name: "Codice Python" });
}

async function esegui(page: Page) {
  await page.getByRole("button", { name: "Esegui" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
}

async function ferma(page: Page) {
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled();
}

/** Primo x (da sinistra) dove la riga y è gialla: dov'è il cerchio. */
async function xCerchio(page: Page): Promise<number> {
  return finestra(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 150, c.width, 1).data;
    for (let x = 0; x < c.width; x++) if (d[x * 4] > 200 && d[x * 4 + 1] > 200 && d[x * 4 + 2] < 80) return x;
    return -1;
  });
}

test("il gioco si apre nel sito e le frecce lo comandano solo quando ha il focus", async ({ page }) => {
  test.slow(); // primo download di Pyodide e pygame
  const editor = await apriGioco(page);
  await expect(editor).toHaveValue(GIOCO);

  await esegui(page);
  await expect.poll(() => dimensioniGioco(page)).toEqual([400, 300]);
  await aspettaColore(page, 390, 290, BLU);
  await aspettaColore(page, 200, 150, GIALLO);

  // Dopo Esegui la tastiera va al gioco
  await expect(finestra(page)).toBeFocused();
  await expect(page.getByText("🎮 La tastiera comanda il gioco")).toBeVisible();
  const prima = await xCerchio(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  await expect.poll(() => xCerchio(page)).toBeGreaterThan(prima + 40);

  // Scrivendo nell'editor il gioco non si muove
  const fermo = await xCerchio(page);
  await editor.click();
  await expect(page.getByText("Clicca sul gioco per usare la tastiera")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("x");
  await page.waitForTimeout(300);
  expect(await xCerchio(page)).toBe(fermo);

  // Stop: il gioco si ferma e si può rieseguire da capo (col codice di prima: la "x" scritta va tolta)
  await ferma(page);
  await editor.fill(GIOCO);
  await esegui(page);
  await aspettaColore(page, 200, 150, GIALLO);
  await ferma(page);
});

test("immagini dalla libreria e dagli allegati, print e mouse", async ({ page, fake }) => {
  test.slow();
  await page.route("**/pgzero-libreria/manifest.json", (route) =>
    route.fulfill({ json: { images: ["alien.png", "non-usata.png"], sounds: ["salto.wav"], music: [], fonts: [] } }));
  await page.route("**/pgzero-libreria/images/alien.png", (route) => route.fulfill({ contentType: "image/png", body: pngPieno([255, 0, 0]) }));
  await page.route("https://allegati.e2e.test/**", (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*", "content-type": "image/png" }, body: pngPieno([0, 255, 0]) }));
  impostaCodice(fake, {
    python_env: "pgzero",
    default_python_code: [
      "WIDTH = 400",
      "HEIGHT = 300",
      'alieno = Actor("alien", (100, 100))',
      'moneta = Actor("moneta", (300, 100))',
      'print("pronti")',
      "",
      "def draw():",
      '    screen.fill("black")',
      "    alieno.draw()",
      "    moneta.draw()",
      "",
      "def on_mouse_down(pos):",
      '    print("clic", pos)',
    ].join("\n"),
    attachments: [{ name: "Moneta.png", url: "https://allegati.e2e.test/moneta-1760.png", type: "image" }],
  });

  await apriGioco(page);
  await esegui(page);
  await aspettaColore(page, 100, 100, [255, 0, 0]); // dalla libreria
  await aspettaColore(page, 300, 100, [0, 255, 0]); // dall'allegato
  await expect(page.getByTestId("pgzero-output")).toHaveText("pronti\n");

  // Il clic al centro della finestra (rimpicciolita o ingrandita) arriva al centro del gioco
  const box = (await finestra(page).boundingBox())!;
  await finestra(page).click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByTestId("pgzero-output")).toContainText("clic (");
  const [cx, cy] = (await page.getByTestId("pgzero-output").textContent())!.match(/clic \((\d+), (\d+)\)/)!.slice(1).map(Number);
  expect(Math.abs(cx - 200)).toBeLessThanOrEqual(3);
  expect(Math.abs(cy - 150)).toBeLessThanOrEqual(3);
  await ferma(page);
});

test("errori in italiano con la riga: nome sconosciuto e immagine che non c'è", async ({ page }) => {
  test.slow();
  const editor = await apriGioco(page);

  await editor.fill('WIDTH = 200\nHEIGHT = 100\n\ndef draw():\n    screen.fill("red")\n\ndef update():\n    punti = vite + 1\n');
  await page.getByRole("button", { name: "Esegui" }).click();
  const errore = page.getByTestId("friendly-error");
  await expect(errore).toContainText("Hai usato un nome che Python non conosce · riga 8");
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled();

  await editor.fill('WIDTH = 200\nHEIGHT = 100\nnave = Actor("astronave")\n');
  await page.getByRole("button", { name: "Esegui" }).click();
  await expect(errore).toContainText("Immagine non trovata · riga 3");
  await expect(errore).toContainText("Il gioco cerca l'immagine astronave");

  // Dopo un errore il gioco successivo parte normalmente
  await editor.fill(GIOCO);
  await esegui(page);
  await aspettaColore(page, 200, 150, GIALLO);
  await expect(errore).toHaveCount(0);
  await ferma(page);
});

test("copia per Replit e link del task restano come alternativa", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(taskUrl);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();

  await page.getByRole("textbox", { name: "Codice Python" }).fill("#pgzero\n" + GIOCO);
  await page.getByRole("button", { name: "Copia codice per Replit" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#pgzero main.py\n" + GIOCO);

  await page.getByRole("button", { name: "Apri Replit" }).click();
  expect(await page.evaluate(() => (window as unknown as { aperti: string[] }).aperti)).toEqual(["https://replit.com/@techland/gioco-astronave"]);
});

test("compito: il codice si salva come bozza e senza link usa il Replit di default", async ({ page, fake }) => {
  impostaCodice(fake, { python_env: "pgzero", default_python_code: GIOCO, replit_url: null });
  await page.goto(compitoUrl);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();

  await page.getByRole("textbox", { name: "Codice Python" }).fill(GIOCO + "# il mio gioco\n");
  await expect
    .poll(() => fake.table("student_code_drafts").find((d) => d.homework_id)?.content, { timeout: 10_000 })
    .toBe(GIOCO + "# il mio gioco\n");
  expect(fake.table("student_code_drafts")[0]).toMatchObject({ student_id: student.id, code_type: "python" });

  await page.getByRole("button", { name: "Apri Replit" }).click();
  expect(await page.evaluate(() => (window as unknown as { aperti: string[] }).aperti)).toEqual(["https://replit.com/@esmir1475/Pygame"]);
});

test("le frecce nel gioco non cambiano task; Python e Pygame Zero convivono nella stessa pagina", async ({ page, fake }) => {
  test.slow(); // due Pyodide: quello di Python e quello di Pygame Zero
  await page.unroute("https://cdn.jsdelivr.net/pyodide/v0.24.1/**");
  fake.rpc("complete_task", () => ({ success: true }));
  // Task 1: Python standard, task 2: il gioco
  Object.assign(fake.table("lesson_tasks")[0], { python_env: "standard", default_python_code: 'print("ciao dal task 1")\n' });
  fake.seed("lesson_tasks", [{ ...codeTask, id: "b0000000-0000-4000-8000-000000000002", task_number: 2, title: "Il gioco", python_env: "pgzero", default_python_code: GIOCO, test_cases: [], attachments: [] }]);

  await page.goto(taskUrl);
  const esegui = page.getByRole("button", { name: "Esegui" });
  await expect(esegui).toBeEnabled({ timeout: 120_000 });

  // Si passa al gioco senza ricaricare la pagina
  await page.getByRole("button", { name: "Task successivo" }).click();
  await expect(page).toHaveURL(/\/task\/2$/);
  await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();
  await expect(esegui).toBeEnabled({ timeout: 120_000 });
  await esegui.click();
  await aspettaColore(page, 200, 150, GIALLO);
  const prima = await xCerchio(page);
  // ← e → muovono il gioco e non portano a un altro task
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => xCerchio(page)).toBeGreaterThan(prima + 20);
  await expect(page).toHaveURL(/\/task\/2$/);

  // Tornando al task Python il suo Pyodide funziona ancora
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("button", { name: "Task precedente" }).click();
  await expect(page).toHaveURL(/\/task\/1$/);
  await expect(esegui).toBeEnabled({ timeout: 60_000 });
  await esegui.click();
  await expect(page.getByTestId("python-output")).toHaveText("ciao dal task 1\n");
});

test("partendo dal gioco, il task Python dopo funziona", async ({ page, fake }) => {
  test.slow();
  await page.unroute("https://cdn.jsdelivr.net/pyodide/v0.24.1/**");
  fake.rpc("complete_task", () => ({ success: true }));
  fake.seed("lesson_tasks", [{ ...codeTask, id: "b0000000-0000-4000-8000-000000000002", task_number: 2, title: "Dopo il gioco", python_env: "standard", default_python_code: 'print("ciao dal task 2")\n', test_cases: [], attachments: [] }]);

  await apriGioco(page);
  await esegui(page);
  await aspettaColore(page, 200, 150, GIALLO);
  await page.getByRole("button", { name: "Task successivo" }).click();
  await expect(page).toHaveURL(/\/task\/2$/);
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 90_000 });
  await page.getByRole("button", { name: "Esegui" }).click();
  await expect(page.getByTestId("python-output")).toHaveText("ciao dal task 2\n");
});

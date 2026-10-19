import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { compitoUrl, esitoCasiDiProva, impostaCodice, preparaAlunno, taskUrl } from "./apri";

/**
 * Compilatore Web: l'anteprima deve mostrare HTML, CSS e JS dell'alunno insieme
 * ai file del task (CSS e JS allegati), e "Verifica" deve valutare tutti i tipi
 * di casi di prova Web. Tutto nel browser, senza rete esterna.
 */

const ALLEGATI = "https://allegati.e2e.test";

const HTML = [
  "<!DOCTYPE html>",
  '<html lang="it">',
  '<head><link rel="stylesheet" href="style.css"></head>',
  "<body>",
  '  <h1 id="titolo">La mia pagina</h1>',
  '  <button id="piu">+1</button>',
  '  <p id="conta">0</p>',
  "  <ul><li>uno</li><li>due</li></ul>",
  '  <canvas id="tela" width="100" height="50"></canvas>',
  "</body>",
  "</html>",
].join("\n");

const CSS = "h1 { color: red; }\nli { font-size: 20px; }";

const JS = [
  'const conta = document.getElementById("conta");',
  'document.getElementById("piu").addEventListener("click", () => {',
  "  conta.textContent = Number(conta.textContent) + 1;",
  "});",
  "// funzione definita nel file JS del task, caricato prima",
  'conta.title = saluta("Luca");',
  'const ctx = document.getElementById("tela").getContext("2d");',
  'ctx.fillStyle = "blue";',
  "ctx.fillRect(0, 0, 100, 50);",
  'window.ordine.push("main.js");',
].join("\n");

const CASI_DI_PROVA = [
  { id: "bottone", name: "C'è il bottone", kind: "dom-exists", selector: "#piu" },
  { id: "titolo", name: "Il titolo giusto", kind: "dom-text", selector: "h1", contains: "la mia pagina" },
  { id: "lista", name: "Lista con almeno 3 voci", kind: "dom-count", selector: "li", min: 3 },
  { id: "rosso", name: "Il titolo è rosso", kind: "css", selector: "h1", property: "color", value: "red" },
  { id: "saluto", name: "Il JS usa la funzione del task", kind: "js", expression: 'document.getElementById("conta").title === "Ciao Luca"' },
];

test.beforeEach(async ({ fake, page }) => {
  // Il compilatore Web non usa Pyodide
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
  // File allegati al task (nello storage nella realtà)
  await page.route(`${ALLEGATI}/**`, (route) => {
    const file = new URL(route.request().url()).pathname;
    const body = file.endsWith(".css")
      ? "body { background-color: rgb(0, 128, 0); }"
      : 'window.ordine = ["task"];\nwindow.saluta = (nome) => "Ciao " + nome;';
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": file.endsWith(".css") ? "text/css" : "text/javascript" }, body });
  });
  await preparaAlunno(page, fake, "web-development", {
    default_html_code: HTML,
    default_css_code: CSS,
    default_js_code: JS,
    attachments: [
      { name: "sfondo.css", url: `${ALLEGATI}/sfondo.css`, type: "css" },
      { name: "libreria.js", url: `${ALLEGATI}/libreria.js`, type: "js" },
    ],
    test_cases: CASI_DI_PROVA,
  });
});

const anteprima = (page: Page) => page.frameLocator('iframe[title="Preview"]').first();

test("anteprima: HTML, CSS, JS e file del task funzionano insieme", async ({ page }) => {
  await page.goto(taskUrl);
  const frame = anteprima(page);

  // Documento completo (doctype, head, body) ridotto al contenuto
  await expect(frame.locator("h1")).toHaveText("La mia pagina");
  await expect(frame.locator("h1")).toHaveCSS("color", "rgb(255, 0, 0)");
  // CSS del task (allegato) prima di quello dell'alunno
  await expect(frame.locator("body")).toHaveCSS("background-color", "rgb(0, 128, 0)");
  // JS del task caricato prima di main.js, che usa la sua funzione
  await expect(frame.locator("#conta")).toHaveAttribute("title", "Ciao Luca");
  expect(await frame.locator("body").evaluate(() => (window as unknown as { ordine: string[] }).ordine)).toEqual(["task", "main.js"]);
  // Eventi
  await frame.getByRole("button", { name: "+1" }).click();
  await frame.getByRole("button", { name: "+1" }).click();
  await expect(frame.locator("#conta")).toHaveText("2");
  // Canvas 2D
  expect(await frame.locator("#tela").evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(50, 25, 1, 1).data))).toEqual([0, 0, 255, 255]);
  // Il file JS del task si vede in sola lettura
  await page.getByRole("tab", { name: "libreria.js" }).click();
  await expect(page.getByText("📌 Sola lettura")).toBeVisible();

  // Modificare l'HTML aggiorna l'anteprima
  await page.getByRole("tab", { name: "HTML" }).click();
  await page.getByRole("textbox", { name: "Codice HTML" }).fill('<h1 id="titolo">Pagina nuova</h1>\n<button id="piu">+1</button>\n<p id="conta">5</p>\n<canvas id="tela"></canvas>');
  await expect(frame.locator("h1")).toHaveText("Pagina nuova");
  await frame.getByRole("button", { name: "+1" }).click();
  await expect(frame.locator("#conta")).toHaveText("6");

  // E così CSS e JS
  await page.getByRole("tab", { name: "CSS" }).click();
  await page.getByRole("textbox", { name: "Codice CSS" }).fill("h1 { color: rgb(0, 0, 255); }");
  await expect(frame.locator("h1")).toHaveCSS("color", "rgb(0, 0, 255)");
  await page.getByRole("tab", { name: "main.js" }).click();
  await page.getByRole("textbox", { name: "Codice JavaScript" }).fill('document.querySelector("h1").textContent = "Scritto dal JS";');
  await expect(frame.locator("h1")).toHaveText("Scritto dal JS");
});

test("Verifica: tutti i tipi di casi di prova Web", async ({ page }) => {
  await page.goto(taskUrl);
  await expect(anteprima(page).locator("h1")).toHaveText("La mia pagina");
  const verifica = page.getByRole("button", { name: "Verifica" }).first();
  const panel = page.getByTestId("test-cases-panel");

  // Il codice di partenza ha solo 2 voci nella lista
  await verifica.click();
  await expect(panel.getByText("4/5 test superati")).toBeVisible();
  expect(await esitoCasiDiProva(page)).toBe("✓✓✗✓✓");

  await page.getByRole("tab", { name: "HTML" }).click();
  await page.getByRole("textbox", { name: "Codice HTML" }).fill(HTML.replace("<li>due</li>", "<li>due</li><li>tre</li>"));
  await verifica.click();
  await expect(panel.getByText("5/5 test superati")).toBeVisible();
  expect(await esitoCasiDiProva(page)).toBe("✓✓✓✓✓");
});

test("compito solo anteprima: mostra la pagina finita", async ({ page, fake }) => {
  impostaCodice(fake, { default_html_code: HTML, default_css_code: CSS, default_js_code: 'window.saluta = (n) => "Ciao " + n;\nwindow.ordine = [];\n' + JS, preview_only: true });
  await page.goto(compitoUrl);
  const frame = anteprima(page);
  await expect(frame.locator("h1")).toHaveText("La mia pagina");
  await expect(frame.locator("h1")).toHaveCSS("color", "rgb(255, 0, 0)");
  await frame.getByRole("button", { name: "+1" }).click();
  await expect(frame.locator("#conta")).toHaveText("1");
  await expect(page.getByRole("textbox", { name: "Codice HTML" })).toHaveCount(0);
});

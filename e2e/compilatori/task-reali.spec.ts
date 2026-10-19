import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import type { FakeSupabase } from "../support/fakeSupabase";
import type { Corpus, CorpusTask } from "../../src/lib/compilerCorpusExport";
import { toReplitMain } from "../../src/lib/pgzero";
import { compitoUrl, eseguiPython, eseguiTurtle, esitoCasiDiProva, impostaCodice, impostaCorso, preparaAlunno, rispondiAiPrompt, taskUrl } from "./apri";
import { leggiDisegno, pixelDisegnati } from "./disegno";

/**
 * Regressione sui task veri dei corsi (e2e/compilatori/task-reali.json,
 * scaricato da Admin → Backup → "Esporta task per i test").
 *
 * Ogni task o compito si apre come lo vede l'alunno e il codice di partenza si
 * esegue (input() riceve sempre "3"). L'esito di riferimento è registrato in
 * __snapshots__/: se un aggiornamento di Pyodide, Skulpt o dei compilatori
 * cambia anche un solo task, il test fallisce e mostra la differenza.
 *
 *   npm run test:compilatori                           tutto
 *   npx playwright test --project=task-reali --update-snapshots   nuovo riferimento
 *
 * Task che non si possono eseguire da soli (es. ciclo infinito senza input):
 * in task-reali.eccezioni.json, "<tipo>-<id>": "motivo".
 */

const QUI = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(QUI, "task-reali.json");
const FILE_ECCEZIONI = path.join(QUI, "task-reali.eccezioni.json");
const PER_GRUPPO = 15;
const RISPOSTA_INPUT = "3";
const MAX_INPUT = 20;

const corpus: Corpus | null = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
const eccezioni: Record<string, string> = existsSync(FILE_ECCEZIONI) ? JSON.parse(readFileSync(FILE_ECCEZIONI, "utf8")) : {};

// Output che cambia a ogni esecuzione: si confronta solo l'esito
const CASUALE = /\b(import\s+(random|time|datetime)|from\s+(random|time|datetime)\s+import)\b/;

const chiave = (t: CorpusTask) => `${t.tipo}-${t.id}`;
const nome = (t: CorpusTask) => `${t.tipo} ${t.corso} L${t.lezione ?? "?"}${t.numero ? `#${t.numero}` : ""} «${t.titolo}»${t.visibile ? "" : " (nascosto)"}`;

function gruppi(): { titolo: string; task: CorpusTask[] }[] {
  if (!corpus) return [];
  const out: { titolo: string; task: CorpusTask[] }[] = [];
  for (const compilatore of ["python", "turtle", "pgzero", "web"] as const) {
    const lista = corpus.task.filter((t) => t.compilatore === compilatore && !(chiave(t) in eccezioni));
    for (let i = 0; i < lista.length; i += PER_GRUPPO) {
      const parte = lista.slice(i, i + PER_GRUPPO);
      out.push({ titolo: `${compilatore} ${i + 1}-${i + parte.length} di ${lista.length}`, task: parte });
    }
  }
  return out;
}

/** Il task diventa il task 1 (o il compito) dell'alunno finto e si apre. */
async function apri(page: Page, fake: FakeSupabase, t: CorpusTask) {
  impostaCorso(fake, t.corso);
  impostaCodice(fake, {
    python_env: t.python_env,
    default_python_code: t.default_python_code,
    default_html_code: t.default_html_code,
    default_css_code: t.default_css_code,
    default_js_code: t.default_js_code,
    replit_url: t.replit_url,
    test_cases: t.test_cases,
    attachments: t.allegati.map(({ name, url, type }) => ({ name, url, type })),
    preview_only: t.preview_only,
  });
  await page.goto(t.tipo === "task" ? taskUrl : compitoUrl);
}

const primaRiga = (testo: string | null) => (testo ?? "").split("\n")[0].replace(/^🤔\s*/, "").trim();
const taglia = (testo: string, max = 2000) => (testo.length > max ? `${testo.slice(0, max)}\n… (${testo.length - max} caratteri in più)` : testo);

async function casiDiProva(page: Page): Promise<string | null> {
  const verifica = page.getByRole("button", { name: "Verifica" }).first();
  if ((await verifica.count()) === 0) return null;
  await verifica.click();
  await expect.poll(() => esitoCasiDiProva(page), { timeout: 90_000 }).toMatch(/^[✓✗]+$/);
  return esitoCasiDiProva(page);
}

async function riassuntoPython(page: Page, t: CorpusTask): Promise<string> {
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 90_000 });
  const prompt = rispondiAiPrompt(page, Array(MAX_INPUT).fill(RISPOSTA_INPUT));
  const esito = await eseguiPython(page);
  prompt.stop();
  const righe = ["compilatore: python", `esito: ${esito.errore ? `errore: ${primaRiga(esito.errore)}` : "ok"}`];
  if (CASUALE.test(t.default_python_code ?? "")) righe.push("output: (casuale, non confrontato)");
  else righe.push("output:", taglia(esito.output));
  const casi = await casiDiProva(page);
  if (casi) righe.push(`casi di prova: ${casi}`);
  return righe.join("\n");
}

async function riassuntoTurtle(page: Page, t: CorpusTask): Promise<string> {
  await expect(page.getByText("🐢 Python Turtle")).toBeVisible();
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 60_000 });
  const prompt = rispondiAiPrompt(page, Array(MAX_INPUT).fill(RISPOSTA_INPUT));
  const esito = await eseguiTurtle(page, { timeout: 120_000 });
  prompt.stop();
  const disegnati = pixelDisegnati(await leggiDisegno(page));
  const righe = [
    "compilatore: turtle",
    `esito: ${esito.errore ? `errore: ${primaRiga(esito.errore)}` : "ok"}`,
    `disegno: ${disegnati > 50 ? "sì" : "vuoto"}`,
  ];
  if (CASUALE.test(t.default_python_code ?? "")) righe.push("output: (casuale, non confrontato)");
  else righe.push("output:", taglia(esito.output));
  return righe.join("\n");
}

async function riassuntoWeb(page: Page): Promise<string> {
  const frame = page.frameLocator('iframe[title="Preview"]').first();
  await expect(frame.locator("body")).toBeAttached({ timeout: 20_000 });
  // Il JS dell'alunno ha un attimo per partire (timer, eventi di load)
  await page.waitForTimeout(500);
  const { testo, errori } = await frame.locator("body").evaluate((body) => ({
    testo: body.innerText,
    errori: (window as unknown as { __erroriAnteprima?: string[] }).__erroriAnteprima ?? [],
  }));
  const normale = testo
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, "hh:mm")
    .trim();
  const righe = ["compilatore: web", "testo:", taglia(normale), `errori JS: ${errori.length ? [...new Set(errori)].join(" | ") : "nessuno"}`];
  const casi = await casiDiProva(page);
  if (casi) righe.push(`casi di prova: ${casi}`);
  return righe.join("\n");
}

if (!corpus) {
  test("task veri dei corsi", () => {
    test.skip(true, "Manca e2e/compilatori/task-reali.json: scaricalo da Admin → Backup → «Esporta task per i test»");
  });
} else {
  test.beforeEach(async ({ page, fake }) => {
    await preparaAlunno(page, fake, "python-base");
    // Errori JS dell'anteprima Web (lo script gira anche negli iframe)
    await page.addInitScript(() => {
      const errori: string[] = [];
      (window as unknown as { __erroriAnteprima: string[] }).__erroriAnteprima = errori;
      window.addEventListener("error", (e) => errori.push(e.message));
    });
    // CSS/JS allegati ai task, con il testo salvato nell'export
    for (const t of corpus.task) {
      for (const a of t.allegati) {
        if (a.contenuto === undefined) continue;
        await page.route(a.url, (route) => route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": "*", "content-type": a.type === "css" ? "text/css" : "text/javascript" },
          body: a.contenuto,
        }));
      }
    }
  });

  for (const gruppo of gruppi()) {
    test(gruppo.titolo, async ({ page, fake }) => {
      test.setTimeout(90_000 + gruppo.task.length * 45_000);
      for (const t of gruppo.task) {
        await test.step(nome(t), async () => {
          await apri(page, fake, t);
          if (t.compilatore === "pgzero") {
            // Il codice da copiare su Replit è quello del task, con l'intestazione per main.py
            await expect(page.getByText("🎮 Pygame Zero")).toBeVisible();
            if (t.default_python_code) await expect.soft(page.getByTestId("pgzero-code"), nome(t)).toHaveText(toReplitMain(t.default_python_code));
            return;
          }
          const riassunto = t.compilatore === "python" ? await riassuntoPython(page, t)
            : t.compilatore === "turtle" ? await riassuntoTurtle(page, t)
            : await riassuntoWeb(page);
          // Senza il titolo: rinominare un task non è una regressione
          expect.soft(`${riassunto}\n`, nome(t)).toMatchSnapshot(`${chiave(t)}.txt`);
        });
      }
    });
  }
}

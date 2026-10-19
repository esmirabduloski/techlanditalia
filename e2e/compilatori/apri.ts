/**
 * Aiuti comuni ai test dei compilatori: un alunno iscritto a un corso con lo
 * slug voluto, il task 1 e il compito con il codice di partenza voluto, e
 * piccole funzioni per eseguire il codice come farebbe l'alunno.
 */
import { expect, type Dialog, type Page } from "@playwright/test";
import type { FakeSupabase } from "../support/fakeSupabase";
import { course, homework, seedStudent, student } from "../support/seed";

export const taskUrl = `/area-riservata/corso/${course.id}/lezione/1/task/1`;
export const compitoUrl = `/area-riservata/compito/${homework.id}`;

export interface CampiCodice {
  default_python_code?: string | null;
  default_html_code?: string | null;
  default_css_code?: string | null;
  default_js_code?: string | null;
  python_env?: string | null;
  replit_url?: string | null;
  test_cases?: unknown[];
  attachments?: { name: string; url: string; type: string }[];
  preview_only?: boolean;
}

const VUOTI: CampiCodice = {
  default_python_code: null,
  default_html_code: null,
  default_css_code: null,
  default_js_code: null,
  python_env: null,
  replit_url: null,
  test_cases: [],
  attachments: [],
};

/** Alunno iscritto al corso `slug`; il task 1 ("misto") e il compito hanno questi campi. */
export async function preparaAlunno(page: Page, fake: FakeSupabase, slug: string, campi: CampiCodice = {}) {
  seedStudent(fake);
  impostaCorso(fake, slug);
  impostaCodice(fake, campi);
  await fake.signInBeforeLoad(page, student);
}

/** Cambia il corso (slug) di task e compito (da chiamare prima di page.goto). */
export function impostaCorso(fake: FakeSupabase, slug: string) {
  fake.table("courses")[0].slug = slug;
  fake.table("enrollments")[0].course = { ...course, slug };
  const lessons = homework.lessons;
  fake.table("homework")[0].lessons = { ...lessons, courses: { ...lessons.courses, slug } };
}

/** Cambia il codice di partenza di task e compito (da chiamare prima di page.goto). */
export function impostaCodice(fake: FakeSupabase, campi: CampiCodice) {
  Object.assign(fake.table("lesson_tasks")[0], VUOTI, { content_type: "mixed" }, campi);
  Object.assign(fake.table("homework")[0], VUOTI, { preview_only: false }, campi);
}

/** Risponde ai prompt() della pagina nell'ordine dato (null = Annulla) e raccoglie i messaggi. */
export function rispondiAiPrompt(page: Page, risposte: (string | null)[]) {
  const coda = [...risposte];
  const messaggi: string[] = [];
  const handler = async (dialog: Dialog) => {
    messaggi.push(dialog.message());
    const risposta = coda.shift();
    if (risposta == null) await dialog.dismiss();
    else await dialog.accept(risposta);
  };
  page.on("dialog", handler);
  return { messaggi, stop: () => page.off("dialog", handler) };
}

export interface Esito {
  output: string;
  /** Testo del riquadro con l'errore spiegato in italiano, se c'è */
  errore: string | null;
}

/** Output ed errore mostrati ora, letti in un colpo solo (gli elementi compaiono e spariscono durante l'esecuzione). */
function leggiEsito(page: Page, outputTestId: string): Promise<Esito> {
  return page.evaluate((id) => {
    const output = document.querySelector(`[data-testid="${id}"]`);
    const errore = document.querySelector<HTMLElement>('[data-testid="friendly-error"]');
    return { output: output?.textContent ?? "", errore: errore ? errore.innerText : null };
  }, outputTestId);
}

/** "Esegui" nel compilatore Python: aspetta la fine e restituisce output ed errore. */
export async function eseguiPython(page: Page): Promise<Esito> {
  const esegui = page.getByRole("button", { name: "Esegui" });
  await page.getByTitle("Pulisci output").click();
  await expect(page.getByTestId("python-output")).toHaveCount(0);
  await expect(page.getByTestId("friendly-error")).toHaveCount(0);
  await esegui.click();
  let esito: Esito = { output: "", errore: null };
  await expect
    .poll(async () => {
      esito = await leggiEsito(page, "python-output");
      return esito.errore !== null || (esito.output !== "" && esito.output !== "Esecuzione in corso...");
    }, { timeout: 30_000 })
    .toBe(true);
  await expect(esegui).toBeEnabled();
  return leggiEsito(page, "python-output");
}

/** "Esegui" nel compilatore Turtle: aspetta che il disegno finisca (torna il pulsante Esegui). */
export async function eseguiTurtle(page: Page, { timeout = 30_000 } = {}): Promise<Esito> {
  const esegui = page.getByRole("button", { name: "Esegui" });
  await esegui.click();
  await expect(esegui).toBeEnabled({ timeout });
  return leggiEsito(page, "turtle-output");
}

/** Sequenza dei casi di prova: ✓ superato, ✗ fallito, · non eseguito. */
export async function esitoCasiDiProva(page: Page): Promise<string> {
  const panel = page.getByTestId("test-cases-panel");
  return panel.evaluate((el) =>
    [...el.querySelectorAll("[data-test-status]")].map((r) => ({ passed: "✓", failed: "✗" })[r.getAttribute("data-test-status") ?? ""] ?? "·").join(""),
  );
}

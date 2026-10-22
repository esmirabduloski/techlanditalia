import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/test";
import { course, parent, student } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Import ed export CSV in blocco dalle pagine admin: lezioni di un corso,
 * gruppi e studenti. L'import mostra un'anteprima riga per riga e scrive solo
 * dopo la conferma; le righe con errori vengono saltate.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

function seedAdmin(fake: FakeSupabase) {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("courses", [course]);
}

/** Apre il menu CSV, aspettando che quello di prima abbia finito di chiudersi. */
async function openCsvMenu(page: Page) {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "CSV", exact: true }).click();
}

async function exportCsv(page: Page): Promise<string> {
  await openCsvMenu(page);
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Esporta CSV" }).click();
  const file = await (await download).path();
  // Il menu torna attivo a export finito
  await expect(page.getByRole("button", { name: "CSV", exact: true })).toBeEnabled();
  return (await readFile(file, "utf-8")).replace(/^\ufeff/, "");
}

async function importCsv(page: Page, csv: string) {
  await openCsvMenu(page);
  await page.getByRole("menuitem", { name: "Importa CSV" }).click();
  await page.getByLabel("File CSV da importare").setInputFiles({ name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
}

const preview = (page: Page) => page.getByRole("list", { name: "Anteprima dell'import" });

test("lezioni: export del programma e import con anteprima", async ({ page, fake }) => {
  seedAdmin(fake);
  fake.seed("lessons", [
    { id: "a0000000-0000-4000-8000-000000000001", course_id: course.id, lesson_number: 1, title: "Primi passi", description: null, objective: "stampare un saluto", points_reward: 50, video_url: null, slides_url: null, concepts: ["sequenze"], content: "<p>Contenuto</p>", content_type: "mixed" },
    { id: "a0000000-0000-4000-8000-000000000002", course_id: course.id, lesson_number: 2, title: "Variabili", description: null, objective: null, points_reward: 30, video_url: null, slides_url: null, concepts: [] },
  ]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto(`/admin/corsi/${course.id}/lezioni`);
  await expect(page.getByRole("heading", { name: "Lezioni" })).toBeVisible();

  const exported = await exportCsv(page);
  expect(exported.split("\r\n")).toEqual([
    '"Numero";"Titolo";"Descrizione";"Obiettivo";"Punti";"Video";"Slide";"Competenze"',
    '"1";"Primi passi";"";"stampare un saluto";"50";"";"";"sequenze"',
    '"2";"Variabili";"";"";"30";"";"";""',
  ]);

  const csv = [
    "Numero;Titolo;Obiettivo;Competenze",
    "1;Primi passi;stampare un saluto;sequenze",
    "2;Le variabili;;variabili",
    "3;Condizioni;scegliere con if;condizioni",
    "3;Doppione;;",
  ].join("\n");
  await importCsv(page, csv);

  await expect(page.getByTestId("csv-import-counts")).toContainText("1 nuova");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 modificata");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 invariata");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 con errori");
  await expect(preview(page)).toContainText('Titolo: "Variabili" → "Le variabili"');
  await expect(preview(page)).toContainText("Numero 3 già usato alla riga 4");
  // Le invariate restano nascoste finché non si chiedono
  await expect(preview(page).locator('[data-status="same"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Importa 2 righe" }).click();
  await expect(page.getByTestId("csv-import-result")).toHaveText("2 righe importate");

  const lessons = fake.table("lessons");
  expect(lessons.find((l) => l.lesson_number === 2)).toMatchObject({ title: "Le variabili", concepts: ["variabili"], points_reward: 30 });
  expect(lessons.find((l) => l.lesson_number === 3)).toMatchObject({ course_id: course.id, title: "Condizioni", objective: "scegliere con if", concepts: ["condizioni"], content_type: "text", points_reward: 50 });
  // Il contenuto della lezione 1 non si tocca
  expect(lessons.find((l) => l.lesson_number === 1)).toMatchObject({ title: "Primi passi", content: "<p>Contenuto</p>" });
  expect(lessons).toHaveLength(3);

  await page.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByText("Condizioni", { exact: true })).toBeVisible();
});

test("gruppi: gruppo nuovo con studenti, righe con errori saltate", async ({ page, fake }) => {
  seedAdmin(fake);
  const teacher = { id: "33333333-3333-4333-8333-333333333333", full_name: "Sara Neri", email: "sara@techland.test", role: "teacher" };
  const existing = { id: "e0000000-0000-4000-8000-000000000001", title: "Python sabato", course_id: course.id, teacher_id: teacher.id, start_date: "2026-10-03", lesson_days: [6], lesson_time: "10:00:00", max_lessons: 32, status: "active", whatsapp_link: null, mega_chat_link: null, teacher_meeting_link: null, student_meeting_link: null, certificates: [], courses: { title: course.title, emoji: course.emoji } };
  fake.seed("profiles", [
    teacher,
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: null },
    { id: "44444444-4444-4444-8444-444444444444", full_name: "Giulia Verdi", username: "giulia", role: "student", parent_id: null },
  ]);
  fake.seed("user_roles", [{ user_id: teacher.id, role: "teacher" }]);
  fake.seed("student_groups", [existing]);
  fake.seed("group_students", [{ group_id: existing.id, student_id: student.id }]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/gruppi");
  await expect(page.getByRole("heading", { name: "Gestione Gruppi" })).toBeVisible();

  const exported = await exportCsv(page);
  expect(exported.split("\r\n")[1]).toBe(
    `"${existing.id}";"Python sabato";"Python Base";"sara@techland.test";"03/10/2026";"Sab";"10:00";"32";"";"";"";"";"luca123";"Attivo";"1"`,
  );

  const csv = [
    "ID;Titolo;Corso;Insegnante;Data inizio;Giorni;Ora;Studenti",
    ";Python domenica;python-base;sara@techland.test;04/10/2026;Dom;9:30;giulia",
    ";Python lunedì;Python Base;;;Lun;;luca123, nessuno",
  ].join("\n");
  await importCsv(page, csv);

  await expect(page.getByTestId("csv-import-counts")).toContainText("1 nuova");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 con errori");
  await expect(preview(page)).toContainText("Calendario di 32 lezioni generato in automatico");
  await expect(preview(page)).toContainText("Studenti non trovati: nessuno");
  await expect(preview(page)).toContainText('luca123 è già nel gruppo "Python sabato" dello stesso corso');

  await page.getByRole("button", { name: "Importa 1 riga" }).click();
  await expect(page.getByTestId("csv-import-result")).toHaveText("1 riga importata");

  const created = fake.table("student_groups").find((g) => g.title === "Python domenica");
  expect(created).toMatchObject({ course_id: course.id, teacher_id: teacher.id, start_date: "2026-10-04", lesson_days: [0], lesson_time: "09:30", max_lessons: 32 });
  expect(fake.table("group_students").filter((m) => m.group_id === created?.id).map((m) => m.student_id)).toEqual(["44444444-4444-4444-8444-444444444444"]);
  expect(fake.table("student_groups")).toHaveLength(2);
});

test("studenti: aggiorna gli esistenti e crea le famiglie nuove dalla edge function", async ({ page, fake }) => {
  seedAdmin(fake);
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, email: parent.email, avatar_id: 1, total_points: 0, lesson_balance: 0 },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, email: "luca123_1@student.techland.local", avatar_id: 2, total_points: 0, lesson_balance: 0 },
  ]);
  const scratch = { ...course, id: "c0000000-0000-4000-8000-000000000002", slug: "scratch", title: "Scratch" };
  fake.seed("courses", [scratch]);
  fake.seed("enrollments", [{ student_id: student.id, course_id: course.id, status: "active" }]);
  fake.fn("admin-import-students", (body) => {
    const rows = (body as { rows: { line: number }[] }).rows;
    return { body: { results: rows.map((r) => ({ line: r.line, ok: true })) } };
  });
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");
  await expect(page.getByRole("heading", { name: "Gestione Utenti" })).toBeVisible();

  const exported = await exportCsv(page);
  expect(exported.split("\r\n")).toEqual([
    '"Username";"Nome studente";"Nome genitore";"Email genitore";"Corsi";"Gruppi"',
    `"luca123";"Luca Bianchi";"Maria Rossi";"maria.rossi@example.com";"Python Base";""`,
  ]);

  const csv = [
    "Username;Nome studente;Nome genitore;Email genitore;Corsi",
    "luca123;Luca Bianchi Rossi;Maria Rossi;maria.rossi@example.com;Python Base, Scratch",
    "Sofia Bianchi;Sofia Bianchi;;maria.rossi@example.com;Scratch",
    "tommaso;Tommaso Gialli;Carla Gialli;carla@example.com;Python Base",
    "elena;Elena Gialli;;carla@example.com;",
    "pietro;Pietro;;;",
  ].join("\n");
  await importCsv(page, csv);

  await expect(page.getByTestId("csv-import-counts")).toContainText("3 nuove");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 modificata");
  await expect(page.getByTestId("csv-import-counts")).toContainText("1 con errori");
  await expect(preview(page)).toContainText("Nuove iscrizioni: Scratch");
  await expect(preview(page)).toContainText("Nuovo studente, figlio di Maria Rossi (maria.rossi@example.com)");
  await expect(preview(page)).toContainText('Username normalizzato in "sofia_bianchi"');
  await expect(preview(page)).toContainText("Nuovo studente e nuovo genitore: Carla Gialli (carla@example.com)");
  await expect(preview(page)).toContainText("Per uno studente nuovo serve l’email del genitore");
  await expect(page.getByText("Invia l'email di benvenuto ai nuovi genitori", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Importa 4 righe" }).click();
  await expect(page.getByTestId("csv-import-result")).toHaveText("4 righe importate");

  // Aggiornamento dal client
  expect(fake.table("profiles").find((p) => p.id === student.id)?.full_name).toBe("Luca Bianchi Rossi");
  expect(fake.table("enrollments").filter((e) => e.student_id === student.id).map((e) => e.course_id).sort()).toEqual([course.id, scratch.id].sort());

  // Creazioni: una sola chiamata, fratelli insieme, email di benvenuto richiesta
  const calls = fake.callsTo("admin-import-students");
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({
    sendWelcome: true,
    rows: [
      { line: 3, parentEmail: "maria.rossi@example.com", parentName: "Maria Rossi", studentName: "Sofia Bianchi", username: "sofia_bianchi", courseIds: [scratch.id] },
      { line: 4, parentEmail: "carla@example.com", parentName: "Carla Gialli", studentName: "Tommaso Gialli", username: "tommaso", courseIds: [course.id] },
      { line: 5, parentEmail: "carla@example.com", parentName: "Carla Gialli", studentName: "Elena Gialli", username: "elena", courseIds: [] },
    ],
  });
});

test("studenti: l'errore dell'edge function arriva nel riepilogo", async ({ page, fake }) => {
  seedAdmin(fake);
  fake.fn("admin-import-students", () => ({ status: 403, body: { error: "Verifica in due passaggi richiesta" } }));
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");
  await importCsv(page, "Username;Nome studente;Nome genitore;Email genitore\nnuovo;Nuovo;Pia;pia@example.com");
  await page.getByText("Invia l'email di benvenuto ai nuovi genitori", { exact: false }).click();
  await page.getByRole("button", { name: "Importa 1 riga" }).click();
  await expect(page.getByTestId("csv-import-result")).toHaveText("0 righe importate, 1 non riuscite");
  await expect(page.getByText("Non importata: Verifica in due passaggi richiesta")).toBeVisible();
  expect((fake.callsTo("admin-import-students")[0].body as { sendWelcome: boolean }).sendWelcome).toBe(false);
});

test.describe("telefono", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test("anteprima leggibile senza scroll orizzontale", async ({ page, fake }) => {
    seedAdmin(fake);
    fake.seed("lessons", [{ id: "a0000000-0000-4000-8000-000000000001", course_id: course.id, lesson_number: 1, title: "Primi passi", points_reward: 50 }]);
    await fake.signInBeforeLoad(page, admin);
    await page.goto(`/admin/corsi/${course.id}/lezioni`);
    const longLink = "https://www.youtube.com/watch?v=" + "x".repeat(80);
    await importCsv(page, `Numero;Titolo;Video\n1;Primi passi con un titolo molto lungo da andare a capo;${longLink}\n2;Seconda;nonunlink`);
    await expect(page.getByTestId("csv-import-counts")).toContainText("1 nuova");
    const overflow = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')!;
      return { dialog: dialog.scrollWidth - dialog.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(overflow).toEqual({ dialog: 0, page: 0 });
  });
});

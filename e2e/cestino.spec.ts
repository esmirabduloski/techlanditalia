import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";

/**
 * Cestino delle eliminazioni (/admin/cestino, migrazione 0069_trash).
 * Il fake non calcola la vista trash_batches: le righe del riepilogo sono
 * messe dai test, e le RPC di ripristino ed eliminazione le tolgono.
 */

// Prima della data reale: la sessione finta non deve risultare scaduta.
const NOW = "2026-10-19T10:00:00+02:00";

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const course = {
  batch_id: "7a000000-0000-4000-8000-000000000001",
  deleted_at: "2026-10-17T12:30:00Z",
  deleted_by: admin.id,
  root_table: "courses",
  root_data: { id: "c1", title: "Python base", slug: "python-base" },
  counts: { courses: 1, lessons: 12, homework_submissions: 40, student_groups: 2 },
  total: 55,
};

const attendance = {
  batch_id: "7a000000-0000-4000-8000-000000000002",
  deleted_at: "2026-09-20T06:00:00Z",
  deleted_by: admin.id,
  root_table: "group_attendance",
  root_data: { id: "a1", group_id: "g1", lesson_number: 3 },
  counts: { group_attendance: 8 },
  total: 8,
};

const term = {
  batch_id: "7a000000-0000-4000-8000-000000000003",
  deleted_at: "2026-10-18T16:00:00Z",
  deleted_by: null,
  root_table: "glossary_terms",
  root_data: { id: "t1", term: "Variabile", slug: "variabile" },
  counts: { glossary_terms: 1 },
  total: 1,
};

test.beforeEach(async ({ page, fake }) => {
  await page.clock.setFixedTime(new Date(NOW));
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, email: admin.email, role: "admin" }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  await fake.signInBeforeLoad(page, admin);
});

test("elenca, ripristina ed elimina per sempre", async ({ page, fake }) => {
  // In ordine sparso: la pagina li chiede dal più recente
  fake.seed("trash_batches", [attendance, course, term]);
  const restored: string[] = [];
  fake.rpc("restore_trash_batch", (args, { fake }) => {
    const id = (args as { _batch: string })._batch;
    restored.push(id);
    const rows = fake.table("trash_batches");
    const i = rows.findIndex((r) => r.batch_id === id);
    const total = rows[i].total;
    rows.splice(i, 1);
    return total;
  });
  fake.rpc("purge_trash_batch", (args, { fake }) => {
    const rows = fake.table("trash_batches");
    rows.splice(rows.findIndex((r) => r.batch_id === (args as { _batch: string })._batch), 1);
    return 1;
  });

  await page.goto("/admin/cestino");
  await expect(page.getByRole("heading", { name: "Cestino", exact: true })).toBeVisible();
  await expect(page.getByText("3 eliminazioni, dalla più recente.")).toBeVisible();

  const items = page.getByTestId("trash-batch");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Termine del glossario «Variabile»");
  await expect(items.nth(0)).toContainText("Ancora 30 giorni");

  const courseItem = items.filter({ hasText: "Corso «Python base»" });
  await expect(courseItem).toContainText("Eliminato il 17 ott 2026");
  await expect(courseItem).toContainText("da Admin Techland");
  await expect(courseItem).toContainText("Insieme a: 40 consegne, 12 lezioni e 2 gruppi");
  await expect(courseItem).toContainText("Ancora 29 giorni");

  // 8 presenze cancellate con un click, a un giorno dalla pulizia
  const attendanceItem = items.filter({ hasText: "8 presenze" });
  await expect(attendanceItem).toContainText("Ancora 1 giorno");

  // Filtro per tipo
  await page.getByRole("combobox", { name: "Filtra per tipo" }).click();
  await page.getByRole("option", { name: "Corso" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Python base");
  await page.getByRole("combobox", { name: "Filtra per tipo" }).click();
  await page.getByRole("option", { name: "Tutti i tipi" }).click();
  await expect(items).toHaveCount(3);

  // Ripristino
  await courseItem.getByRole("button", { name: "Ripristina" }).click();
  await expect(page.getByText("Ripristinato: Corso «Python base»", { exact: true })).toBeVisible();
  await expect(page.getByText("Insieme a 54 elementi collegati.", { exact: true })).toBeVisible();
  expect(restored).toEqual([course.batch_id]);
  await expect(items).toHaveCount(2);

  // Eliminazione definitiva, con conferma
  await items.filter({ hasText: "8 presenze" }).getByRole("button", { name: "Elimina per sempre" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("8 presenze non si potrà più ripristinare.");
  await dialog.getByRole("button", { name: "Elimina per sempre" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Variabile");
});

test("spiega perché un ripristino non riesce", async ({ page, fake }) => {
  fake.seed("trash_batches", [course]);
  await page.route("**/rest/v1/rpc/restore_trash_batch", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "23505", message: "trash_conflict", details: "courses", hint: "Python base" }),
    }),
  );

  await page.goto("/admin/cestino");
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(page.getByText("Non posso ripristinare", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Corso «Python base» esiste già con gli stessi dati (per esempio lo stesso slug o la stessa email). Rinomina o elimina quello nuovo e riprova.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByTestId("trash-batch")).toHaveCount(1);
});

test("svuota il cestino dopo la conferma", async ({ page, fake }) => {
  fake.seed("trash_batches", [course, term]);
  let emptied = 0;
  fake.rpc("empty_trash", (_args, { fake }) => {
    emptied++;
    fake.table("trash_batches").length = 0;
    return 2;
  });

  await page.goto("/admin/cestino");
  await page.getByRole("button", { name: "Svuota cestino" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Tutte le 2 eliminazioni nel cestino diventano definitive");
  await dialog.getByRole("button", { name: "Svuota cestino" }).click();
  await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();
  expect(emptied).toBe(1);
});

test("senza la migrazione mostra l'avviso", async ({ page }) => {
  await page.route("**/rest/v1/trash_batches**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.trash_batches' in the schema cache" }),
    }),
  );
  await page.goto("/admin/cestino");
  await expect(page.getByText(/la migrazione 0069_trash va applicata da Lovable/)).toBeVisible();
  await expect(page.getByTestId("trash-batch")).toHaveCount(0);
});

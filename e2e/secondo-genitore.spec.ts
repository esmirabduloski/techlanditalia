import { test, expect } from "./support/test";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Secondo genitore (migrazione 0077): l'admin crea un account solo per il
 * genitore e lo collega a un figlio che ha già il primo genitore; il secondo
 * genitore entra nell'area riservata e vede il figlio; nel CRM sta nella stessa
 * scheda del lead del primo.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const secondParent: FakeUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "paolo.bianchi@example.com",
  password: "password-di-prova",
  fullName: "Paolo Bianchi",
};

const lead = {
  id: "e0000000-0000-4000-8000-000000000001",
  email: parent.email,
  full_name: parent.fullName,
  phone: null,
  source: "registered",
  pipeline_stage: "won",
  tags: [],
  lead_score: 0,
  lifetime_value_cents: 0,
  linked_profile_id: parent.id,
  deleted_at: null,
  next_followup_at: null,
  created_at: "2026-09-01T10:00:00Z",
  // Colonne della migrazione 0077
  second_parent_name: null,
  second_parent_email: null,
  second_parent_phone: null,
};

function seedFamily(fake: FakeSupabase) {
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, email: parent.email, role: "parent", parent_id: null, total_points: 0, avatar_id: 1, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 340, avatar_id: 2, lesson_balance: 4 },
  ]);
}

function seedAdmin(fake: FakeSupabase) {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
}

/** Come admin_set_parent_children (0077): senza genitore → principale, altrimenti secondo genitore. */
function setParentChildren(args: unknown, { fake }: { fake: FakeSupabase }) {
  const { _parent, _children } = args as { _parent: string; _children: string[] };
  for (const id of _children) {
    const child = fake.table("profiles").find((p) => p.id === id)!;
    if (!child.parent_id) child.parent_id = _parent;
    else if (child.parent_id !== _parent) fake.seed("student_guardians", [{ student_id: id, guardian_id: _parent }]);
  }
  return null;
}

test("Utenti: crea solo il genitore e lo collega a un figlio che ha già un genitore", async ({ page, fake }) => {
  seedAdmin(fake);
  seedFamily(fake);
  fake.fn("admin-create-user", (body) => {
    const { email, fullName } = body as { email: string; fullName: string };
    fake.seed("profiles", [{ id: secondParent.id, full_name: fullName, email, role: "parent", parent_id: null, total_points: 0, avatar_id: 1 }]);
    return { body: { success: true, userId: secondParent.id } };
  });
  fake.rpc("admin_set_parent_children", setParentChildren);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");

  await page.getByRole("button", { name: "Crea utente" }).click();
  const create = page.getByRole("dialog", { name: "Crea nuovo utente" });
  await create.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Solo genitore" }).click();
  await expect(create.getByText("Dati del figlio")).toHaveCount(0);
  await create.getByPlaceholder("Mario Rossi").fill(secondParent.fullName!);
  await create.getByPlaceholder("email@esempio.it").fill(secondParent.email);
  await create.getByRole("button", { name: "Genera" }).click();
  await create.getByRole("button", { name: "Crea utente" }).click();

  const [call] = fake.callsTo("admin-create-user");
  expect(call.body).toMatchObject({ role: "parent", email: secondParent.email, fullName: secondParent.fullName });
  expect(call.body).not.toHaveProperty("childName");

  // Subito dopo la creazione si scelgono i figli: Luca ha già Maria come genitore
  const assign = page.getByRole("dialog", { name: `Assegna Figli - ${secondParent.fullName}` });
  await expect(assign).toBeVisible();
  await expect(assign.getByText(`Genitore: ${parent.fullName}`)).toBeVisible();
  await assign.getByText(student.fullName!, { exact: true }).click();
  await expect(assign.getByText("si aggiunge come secondo genitore", { exact: false })).toBeVisible();
  await assign.getByRole("button", { name: "Salva" }).click();
  await expect(assign).toBeHidden();

  expect(fake.table("student_guardians")).toEqual([
    expect.objectContaining({ student_id: student.id, guardian_id: secondParent.id }),
  ]);
  // Luca resta figlio principale di Maria
  expect(fake.table("profiles").find((p) => p.id === student.id)?.parent_id).toBe(parent.id);

  // Luca compare nelle famiglie di entrambi, con l'altro genitore indicato
  await page.getByRole("heading", { name: secondParent.fullName }).click();
  await expect(page.getByText(`Anche figlio di ${parent.fullName}`)).toBeVisible();
  await page.getByRole("heading", { name: parent.fullName }).click();
  await expect(page.getByText(`Anche figlio di ${secondParent.fullName}`)).toBeVisible();
});

test("Area riservata: il secondo genitore vede il figlio", async ({ page, fake }) => {
  seedFamily(fake);
  fake.addUser(secondParent);
  fake.seed("profiles", [{ id: secondParent.id, full_name: secondParent.fullName, email: secondParent.email, role: "parent", parent_id: null, total_points: 0, avatar_id: 1, onboarding_completed: true }]);
  fake.seed("student_guardians", [{ student_id: student.id, guardian_id: secondParent.id }]);
  await fake.signInBeforeLoad(page, secondParent);
  await page.goto("/area-riservata");

  await expect(page.getByRole("heading", { name: "Ciao, Paolo! 👋" })).toBeVisible();
  await expect(page.getByText(student.fullName!).first()).toBeVisible();
});

test("CRM: il secondo genitore nella stessa scheda del lead", async ({ page, fake }) => {
  seedAdmin(fake);
  seedFamily(fake);
  fake.seed("crm_leads", [lead]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/crm");
  await page.getByText(parent.fullName!, { exact: true }).first().click();

  await page.getByRole("button", { name: "Aggiungi secondo genitore" }).click();
  await page.getByLabel("Nome", { exact: true }).last().fill(secondParent.fullName!);
  await page.getByLabel("Telefono").last().fill("+39 333 1234567");
  await page.getByLabel("Email").last().fill("Paolo.Bianchi@example.com");
  await page.getByLabel("Email").last().blur();

  await expect.poll(() => fake.table("crm_leads")[0]).toMatchObject({
    second_parent_name: secondParent.fullName,
    second_parent_phone: "+39 333 1234567",
    second_parent_email: secondParent.email,
  });
  expect(fake.table("crm_leads")).toHaveLength(1);

  // "Crea account" apre Utenti in modalità "Solo genitore", con i figli del primo da collegare
  const href = await page.getByRole("link", { name: "Crea account" }).getAttribute("href");
  const url = new URL(href!, "https://techland.test");
  expect(url.pathname).toBe("/admin/utenti");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    create: "1",
    role: "parent_only",
    email: secondParent.email,
    name: secondParent.fullName,
    children_of: parent.id,
  });
  await expect(page.getByRole("link", { name: "WhatsApp" }).last()).toHaveAttribute("href", /wa\.me\/393331234567/);
});

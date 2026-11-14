import { test, expect } from "./support/test";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";
import { parent, student } from "./support/seed";

/**
 * Sblocco dell'accesso: un alunno ha sbagliato la password troppe volte e il
 * login è bloccato per 15 minuti. L'admin lo vede in Utenti e lo sblocca
 * subito (edge function admin-login-lock).
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

function seed(fake: FakeSupabase) {
  fake.addUser(admin);
  fake.seed("profiles", [
    { id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email },
    { id: parent.id, full_name: parent.fullName, email: parent.email, role: "parent", parent_id: null, total_points: 0, avatar_id: 1 },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 10, avatar_id: 2 },
  ]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
}

test("Utenti: l'admin sblocca subito un alunno bloccato per troppi tentativi", async ({ page, fake }) => {
  seed(fake);
  let locked = true;
  fake.fn("admin-login-lock", (body) => {
    const { action, userId } = body as { action: string; userId?: string };
    if (action === "unlock") {
      locked = false;
      return { body: { success: true, cleared: 10, userId } };
    }
    return { body: { locked: locked ? [{ userId: student.id, failedAttempts: 10, retryAfterSeconds: 600 }] : [] } };
  });
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");

  const banner = page.getByText("Account bloccati per troppi tentativi di accesso").locator("..").locator("..");
  await expect(banner).toBeVisible();
  await expect(banner.getByText(student.fullName!)).toBeVisible();

  await banner.getByRole("button", { name: "Sblocca" }).click();
  await expect(page.getByText("Account sbloccato", { exact: true })).toBeVisible();
  await expect(page.getByText("Account bloccati per troppi tentativi di accesso")).toHaveCount(0);

  const unlock = fake.callsTo("admin-login-lock").find((c) => (c.body as { action: string }).action === "unlock");
  expect(unlock?.body).toEqual({ action: "unlock", userId: student.id });
});

test("Utenti: nessun banner se nessun account è bloccato", async ({ page, fake }) => {
  seed(fake);
  fake.fn("admin-login-lock", () => ({ body: { locked: [] } }));
  await fake.signInBeforeLoad(page, admin);
  await page.goto("/admin/utenti");

  await expect(page.getByRole("heading", { name: parent.fullName })).toBeVisible();
  await expect(page.getByText("Account bloccati per troppi tentativi di accesso")).toHaveCount(0);
  await expect(page.getByText("Accesso bloccato")).toHaveCount(0);
});

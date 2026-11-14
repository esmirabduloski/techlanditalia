import { describe, expect, it, vi } from "vitest";
import { createChildAccount } from "./familyaccounts";
import { parentFallbackAllowed } from "./studentpassword";

function mockAdmin() {
  const settings: Record<string, unknown>[] = [];
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "child-id" } }, error: null });
  const admin = {
    auth: { admin: { createUser, deleteUser: vi.fn() } },
    from: (table: string) => ({
      upsert: async (value: Record<string, unknown>) => {
        if (table === "student_password_settings") settings.push(value);
        return { error: null };
      },
    }),
  };
  return { admin: admin as unknown as Parameters<typeof createChildAccount>[0], createUser, settings };
}

describe("initial child credentials", () => {
  it("uses the parent's initial password when creating the child", async () => {
    const { admin, createUser, settings } = mockAdmin();
    await createChildAccount(admin, {
      parentId: "parent-id", childName: "Test", childUsername: "test-alunno",
      courseIds: [], initialPassword: "Test-Family-482!",
    });
    expect(createUser.mock.calls[0][0].password).toBe("Test-Family-482!");
    expect(settings[0]).toMatchObject({ own_password: false, set_by: null, set_at: null });
  });

  it("allows the parent password for imports with no known initial password", async () => {
    const { admin, settings } = mockAdmin();
    await createChildAccount(admin, {
      parentId: "parent-id", childName: "Test", childUsername: "test-alunno", courseIds: [],
    });
    expect(settings[0].own_password).toBe(false);
    expect(parentFallbackAllowed({ own_password: settings[0].own_password as boolean })).toBe(true);
  });
});
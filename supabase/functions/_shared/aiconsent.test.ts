import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAiConsent } from "./aiconsent.ts";

/** Client finto: il ruolo del profilo e la risposta di ai_access_allowed */
function fakeAdmin(role: string | null, allowed: boolean) {
  const calls: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
        }),
      }),
    }),
    rpc: async (name: string) => {
      calls.push(name);
      return { data: allowed, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("requireAiConsent", () => {
  it("lascia passare lo studente con il consenso", async () => {
    const { client } = fakeAdmin("student", true);
    expect(await requireAiConsent(client, "s1", {})).toBeNull();
  });

  it("blocca lo studente senza consenso con un 403", async () => {
    const { client } = fakeAdmin("student", false);
    const res = await requireAiConsent(client, "s1", {});
    expect(res?.status).toBe(403);
    expect(await res?.json()).toMatchObject({ ai_consent_required: true });
  });

  it("gli adulti non hanno bisogno del consenso del genitore", async () => {
    const { client, calls } = fakeAdmin("parent", false);
    expect(await requireAiConsent(client, "p1", {})).toBeNull();
    expect(calls).toEqual([]);
  });

  it("senza profilo nega", async () => {
    const { client } = fakeAdmin(null, false);
    expect((await requireAiConsent(client, "x", {}))?.status).toBe(403);
  });
});

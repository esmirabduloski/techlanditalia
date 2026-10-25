import { describe, expect, it } from "vitest";
import { isMissingFunction, purgeAccountBatch, trashAccount, type AccountTrashClient } from "./accounttrash";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

/** Finto client: risposte RPC prefissate e uno storage che registra cosa cancella. */
function fakeClient(responses: Record<string, RpcResponse>, files: Record<string, string[]> = {}) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const removed: string[] = [];
  const client: AccountTrashClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve(responses[fn] ?? { data: null, error: { message: `rpc ${fn} inattesa` } });
    },
    storage: {
      from: (bucket) => ({
        list: (prefix) =>
          Promise.resolve({
            data: (files[`${bucket}/${prefix}`] ?? []).map((name) => ({ name, id: name })),
            error: null,
          }),
        remove: (paths) => {
          removed.push(...paths.map((p) => `${bucket}/${p}`));
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
  return { client, calls, removed };
}

const USER = "00000000-0000-4000-8000-000000000201";
const CHILD = "00000000-0000-4000-8000-000000000101";
const ADMIN = "00000000-0000-4000-8000-000000000901";
const BATCH = "7a000000-0000-4000-8000-000000000001";

describe("trashAccount", () => {
  it("passa account e autore a trash_account e restituisce il batch", async () => {
    const { client, calls } = fakeClient({ trash_account: { data: BATCH, error: null } });
    expect(await trashAccount(client, USER, ADMIN)).toEqual({ ok: true, batchId: BATCH });
    expect(calls).toEqual([{ fn: "trash_account", args: { _user: USER, _by: ADMIN } }]);
  });

  it("distingue account mancante, migrazione non applicata e altri errori", async () => {
    const notFound = fakeClient({ trash_account: { data: null, error: { code: "P0002", message: "account_not_found" } } });
    expect(await trashAccount(notFound.client, USER, USER)).toMatchObject({ ok: false, reason: "not_found" });

    const missing = fakeClient({
      trash_account: { data: null, error: { code: "PGRST202", message: "Could not find the function public.trash_account" } },
    });
    expect(await trashAccount(missing.client, USER, USER)).toMatchObject({ ok: false, reason: "not_ready" });

    const failed = fakeClient({ trash_account: { data: null, error: { code: "23503", message: "violates foreign key" } } });
    expect(await trashAccount(failed.client, USER, USER)).toEqual({
      ok: false,
      reason: "failed",
      message: "violates foreign key",
    });
  });

  it("riconosce le funzioni SQL non ancora create", () => {
    expect(isMissingFunction({ code: "PGRST202", message: "" })).toBe(true);
    expect(isMissingFunction({ code: "42883", message: "" })).toBe(true);
    expect(isMissingFunction({ code: "P0001", message: "" })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });
});

describe("purgeAccountBatch", () => {
  it("elimina i login e poi i file di ogni account del batch", async () => {
    const { client, calls, removed } = fakeClient(
      { purge_account_trash: { data: [USER, CHILD], error: null } },
      { [`homework-files/${CHILD}`]: ["compito.py"], [`student-web-assets/${CHILD}`]: ["sito.css"] },
    );
    expect(await purgeAccountBatch(client, BATCH)).toEqual({ userIds: [USER, CHILD], fileErrors: [] });
    expect(calls).toEqual([{ fn: "purge_account_trash", args: { _batch: BATCH } }]);
    expect(removed.sort()).toEqual([`homework-files/${CHILD}/compito.py`, `student-web-assets/${CHILD}/sito.css`]);
  });

  it("un batch già ripristinato o eliminato non è un errore", async () => {
    const { client, removed } = fakeClient({
      purge_account_trash: { data: null, error: { code: "P0002", message: "trash_not_found" } },
    });
    expect(await purgeAccountBatch(client, BATCH)).toEqual({ userIds: [], fileErrors: [] });
    expect(removed).toEqual([]);
  });

  it("se il database rifiuta non tocca i file", async () => {
    const { client, removed } = fakeClient({
      purge_account_trash: { data: null, error: { code: "23503", message: "violates foreign key constraint" } },
    });
    await expect(purgeAccountBatch(client, BATCH)).rejects.toThrow(/violates foreign key/);
    expect(removed).toEqual([]);
  });
});

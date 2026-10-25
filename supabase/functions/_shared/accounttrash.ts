/**
 * Account eliminati nel Cestino per 30 giorni (drizzle/migrations/0076_account_trash.sql).
 *
 * trashAccount: login bloccato, profilo (con i figli di un genitore) e dati
 * collegati in un batch del cestino. Usato da delete-my-account e da
 * admin-set-password (action "delete") al posto di auth.admin.deleteUser.
 *
 * purgeAccountBatch: eliminazione definitiva, da purge-deleted-accounts.
 * Prima cancella i login nel database (purge_account_trash), poi i file nello
 * storage: se i file non si cancellano l'account è comunque eliminato, come
 * faceva l'eliminazione diretta.
 *
 * Client service role. I 30 giorni sono anche in src/lib/trash.ts
 * (TRASH_RETENTION_DAYS) e nel job pg_cron purge-deleted-accounts-daily.
 */
import { removeUserFiles, type StorageLike } from "./userfiles.ts";

export const ACCOUNT_TRASH_DAYS = 30;

interface RpcError {
  code?: string;
  message: string;
}
type RpcResult = PromiseLike<{ data: unknown; error: RpcError | null }>;

// Solo le parti del client Supabase usate qui (così i test usano un finto client)
export interface RpcLike {
  rpc(fn: string, args?: Record<string, unknown>): RpcResult;
}
export interface AccountTrashClient extends RpcLike {
  storage: StorageLike;
}

/** Funzione SQL non ancora creata: la migrazione 0076 non è applicata. */
export function isMissingFunction(error: RpcError | null | undefined): boolean {
  return ["PGRST202", "42883"].includes(error?.code ?? "");
}

export type TrashAccountResult =
  | { ok: true; batchId: string }
  | { ok: false; reason: "not_found" | "not_ready" | "failed"; message: string };

/** Mette nel cestino l'account `userId` (e i figli se è un genitore). `by` = chi elimina. */
export async function trashAccount(admin: RpcLike, userId: string, by: string): Promise<TrashAccountResult> {
  const { data, error } = await admin.rpc("trash_account", { _user: userId, _by: by });
  if (!error && typeof data === "string") return { ok: true, batchId: data };
  if (error?.message?.startsWith("account_not_found")) {
    return { ok: false, reason: "not_found", message: error.message };
  }
  if (isMissingFunction(error)) return { ok: false, reason: "not_ready", message: error!.message };
  return { ok: false, reason: "failed", message: error?.message ?? "trash_account non ha restituito il batch" };
}

export interface PurgeResult {
  /** Account eliminati per sempre (vuoto se il batch non c'era più) */
  userIds: string[];
  /** "<id> <bucket>: <errore>" per i file non cancellati */
  fileErrors: string[];
}

/**
 * Elimina per sempre un batch di account. Un batch già ripristinato o
 * eliminato (trash_not_found) non è un errore: restituisce userIds vuoto.
 */
export async function purgeAccountBatch(admin: AccountTrashClient, batchId: string): Promise<PurgeResult> {
  const { data, error } = await admin.rpc("purge_account_trash", { _batch: batchId });
  if (error) {
    if (error.message?.startsWith("trash_not_found")) return { userIds: [], fileErrors: [] };
    throw new Error(`purge_account_trash ${batchId}: ${error.message}`);
  }
  const userIds = Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : [];
  const fileErrors: string[] = [];
  for (const id of userIds) {
    try {
      const { errors } = await removeUserFiles(admin.storage, id);
      fileErrors.push(...errors.map((e) => `${id} ${e}`));
    } catch (e) {
      fileErrors.push(`${id} ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { userIds, fileErrors };
}

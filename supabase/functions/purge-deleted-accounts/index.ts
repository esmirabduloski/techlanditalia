/**
 * Eliminazione definitiva degli account nel Cestino (migrazione 0076_account_trash).
 *
 * POST {} con header x-cron-token: il job pg_cron purge-deleted-accounts-daily
 *   (solo quando c'è un account nel cestino da più di 30 giorni) elimina i
 *   batch di account più vecchi di 30 giorni.
 * POST { batchIds } da un admin con 2FA: "Elimina per sempre" e "Svuota
 *   cestino" in /admin/cestino eliminano subito quei batch.
 *
 * Per ogni batch purgeAccountBatch cancella i login (con ruoli, consensi,
 * dispositivi) e poi i file nello storage. Batch non eliminati e file rimasti
 * vengono segnalati agli admin.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { ACCOUNT_TRASH_DAYS, purgeAccountBatch } from "../_shared/accounttrash.ts";

const FN = "purge-deleted-accounts";

const BodySchema = z.object({
  batchIds: z.array(z.string().uuid()).min(1).max(100).optional(),
});

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let isCron = false;
  const cronToken = req.headers.get("x-cron-token") ?? "";
  if (cronToken) {
    const { data: ok } = await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken });
    isCron = ok === true;
  }
  if (!isCron) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = auth.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Non autorizzato" }, 401);
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Non autorizzato" }, 403);
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Dati non validi" }, 400);

  try {
    let batchIds: string[];
    if (isCron) {
      const cutoff = new Date(Date.now() - ACCOUNT_TRASH_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase.from("account_trash").select("batch_id").lt("deleted_at", cutoff);
      if (error) throw new Error(`account_trash: ${error.message}`);
      batchIds = [...new Set((data ?? []).map((r: { batch_id: string }) => r.batch_id))];
    } else {
      if (!parsed.data.batchIds) return json({ error: "batchIds mancante" }, 400);
      batchIds = parsed.data.batchIds;
    }

    let purged = 0;
    const failed: string[] = [];
    const fileErrors: string[] = [];
    for (const batchId of batchIds) {
      try {
        const result = await purgeAccountBatch(supabase, batchId);
        purged += result.userIds.length;
        fileErrors.push(...result.fileErrors);
      } catch (e) {
        failed.push(batchId);
        await captureServerError(e, { fn: FN, tags: isCron ? { area: "cron" } : {}, extra: { batchId } });
      }
    }

    if (fileErrors.length > 0) console.error(`[${FN}] file non cancellati:`, fileErrors);
    if (failed.length > 0 || fileErrors.length > 0) {
      await notifyAdmins({
        title: "Cestino: eliminazione account incompleta",
        body: [
          failed.length > 0 ? `${failed.length} account non eliminati, restano nel Cestino.` : "",
          fileErrors.length > 0 ? "Alcuni file nello storage non sono stati cancellati (log di purge-deleted-accounts)." : "",
        ].filter(Boolean).join(" "),
        path: "/admin/cestino",
        type: "account_deleted",
      });
    }

    console.log(`[${FN}] ${purged} account eliminati per sempre (${batchIds.length} batch, ${failed.length} non riusciti)`);
    return json({ ok: failed.length === 0, purged, failed, fileErrors }, failed.length > 0 ? 500 : 200);
  } catch (err) {
    await captureServerError(err, { fn: FN, tags: isCron ? { area: "cron" } : {} });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

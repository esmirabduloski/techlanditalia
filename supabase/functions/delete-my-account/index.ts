/**
 * Cancellazione account self-service (diritto all'oblio, art. 17 GDPR).
 *
 * POST { confirm: "ELIMINA" } con il JWT dell'utente.
 * Solo i GENITORI possono usarla. Il loro account e quelli degli studenti
 * collegati finiscono nel Cestino come nell'eliminazione da admin
 * (admin-set-password, action "delete"; trashAccount, migrazione 0076):
 * l'accesso si blocca subito, ma per 30 giorni un admin può ripristinare
 * tutto com'era, se il genitore ha eliminato l'account per sbaglio. Poi
 * purge-deleted-accounts elimina per sempre login e file nello storage.
 * Studenti e insegnanti passano dal genitore o dalla scuola; gli admin non
 * possono auto-eliminarsi.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { ACCOUNT_TRASH_DAYS, trashAccount } from "../_shared/accounttrash.ts";

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: { user }, error: authError } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "ELIMINA") return json({ error: "Conferma mancante" }, 400);

    const { data: profile } = await admin.from("profiles").select("role, full_name, email").eq("id", user.id).maybeSingle();
    const { data: adminRole } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (adminRole) return json({ error: "Gli account amministratore non possono essere eliminati da qui" }, 403);
    if (profile?.role !== "parent") {
      return json({ error: "Solo l'account del genitore può essere eliminato da qui. Scrivici a info@techlanditalia.it." }, 403);
    }

    const { data: ownChildren } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("parent_id", user.id)
      .eq("role", "student");
    // Chi ha anche un altro genitore resta a lui (trash_account, 0077): senza la
    // tabella student_guardians la lettura fallisce e vanno tutti nel cestino
    const { data: shared } = await admin
      .from("student_guardians")
      .select("student_id")
      .in("student_id", (ownChildren ?? []).map((c) => c.id));
    const sharedIds = new Set((shared ?? []).map((s) => s.student_id as string));
    const children = (ownChildren ?? []).filter((c) => !sharedIds.has(c.id));

    // Senza la migrazione 0076 non si elimina niente: meglio un errore di
    // un'eliminazione definitiva quando la pagina promette 30 giorni
    const trashed = await trashAccount(admin, user.id, user.id);
    if (!trashed.ok) {
      console.error(`[delete-my-account] ${user.id}:`, trashed.message);
      return trashed.reason === "not_ready"
        ? json({ error: "Al momento non è possibile eliminare l'account. Riprova più tardi o scrivici a info@techlanditalia.it." }, 503)
        : json({ error: "Impossibile eliminare l'account. Scrivici a info@techlanditalia.it." }, 500);
    }

    console.log(`[delete-my-account] ${user.id} nel cestino con ${children?.length ?? 0} figli (batch ${trashed.batchId})`);

    // Avviso interno agli admin: possono ripristinarlo dal Cestino
    const task = notifyAdmins({
      title: "Account genitore eliminato",
      body: `${profile?.full_name ?? user.email ?? "Un genitore"} ha eliminato il proprio account (${children?.length ?? 0} studenti). ` +
        `Resta nel Cestino per ${ACCOUNT_TRASH_DAYS} giorni.`,
      path: "/admin/cestino",
      type: "account_deleted",
    });
    try {
      // @ts-ignore EdgeRuntime disponibile su Supabase Edge Functions
      EdgeRuntime.waitUntil(task);
    } catch {
      task.catch(() => undefined);
    }

    return json({ success: true, deletedChildren: children?.length ?? 0, recoverableDays: ACCOUNT_TRASH_DAYS });
  } catch (error) {
    console.error("[delete-my-account]", error);
    return json({ error: "Errore interno" }, 500);
  }
});

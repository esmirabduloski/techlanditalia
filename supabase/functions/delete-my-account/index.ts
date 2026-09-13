/**
 * Cancellazione account self-service (diritto all'oblio, art. 17 GDPR).
 *
 * POST { confirm: "ELIMINA" } con il JWT dell'utente.
 * Solo i GENITORI possono usarla: elimina prima gli account degli studenti
 * collegati, poi il genitore. Le tabelle collegate (profili, iscrizioni,
 * progressi, compiti…) si cancellano a cascata come nell'eliminazione da admin
 * (admin-set-password, action "delete"). Studenti e insegnanti passano dal
 * genitore o dalla scuola; gli admin non possono auto-eliminarsi.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";

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

    const { data: children } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("parent_id", user.id)
      .eq("role", "student");

    const failed: string[] = [];
    for (const child of children ?? []) {
      const { error } = await admin.auth.admin.deleteUser(child.id);
      if (error) {
        console.error(`[delete-my-account] figlio ${child.id}:`, error.message);
        failed.push(child.full_name ?? child.id);
      }
    }
    if (failed.length > 0) {
      return json({ error: `Non sono riuscito a eliminare gli account di: ${failed.join(", ")}. Scrivici a info@techlanditalia.it.` }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[delete-my-account] genitore:", deleteError.message);
      return json({ error: "Impossibile eliminare l'account. Scrivici a info@techlanditalia.it." }, 500);
    }

    console.log(`[delete-my-account] ${user.id} eliminato con ${children?.length ?? 0} figli`);

    // Avviso interno agli admin (contabilità/CRM potrebbero avere riferimenti da aggiornare)
    const task = notifyAdmins({
      title: "Account genitore eliminato",
      body: `${profile?.full_name ?? user.email ?? "Un genitore"} ha eliminato il proprio account (${children?.length ?? 0} studenti).`,
      path: "/admin/utenti",
      type: "account_deleted",
    });
    try {
      // @ts-ignore EdgeRuntime disponibile su Supabase Edge Functions
      EdgeRuntime.waitUntil(task);
    } catch {
      task.catch(() => undefined);
    }

    return json({ success: true, deletedChildren: children?.length ?? 0 });
  } catch (error) {
    console.error("[delete-my-account]", error);
    return json({ error: "Errore interno" }, 500);
  }
});

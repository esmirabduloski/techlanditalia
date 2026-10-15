/**
 * Il genitore imposta la password del figlio dall'area riservata.
 *
 * POST { childId, newPassword } con il JWT del genitore.
 * - Il figlio deve essere uno studente con parent_id = chiamante (controllo
 *   lato server, il browser non decide nulla).
 * - Se il genitore ha la verifica in due passaggi attiva serve la sessione aal2.
 * - Cambia solo la password del figlio e la segna come "propria": da quel
 *   momento la password del genitore non vale più per il figlio
 *   (drizzle/migrations/0046_student_passwords.sql).
 * - Cancella i tentativi falliti del figlio, così se era bloccato rientra subito.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, hasVerifiedFactor, mfaRequiredResponse } from "../_shared/mfa.ts";
import { isWeakPasswordError, validateChildPassword, WEAK_PASSWORD_MESSAGE } from "../_shared/studentpassword.ts";

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = auth.replace("Bearer ", "");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const limited = await rateLimit(req, {
      endpoint: "parent-set-child-password",
      identifier: user.id,
      maxRequests: 10,
      windowSeconds: 3600,
      message: "Hai cambiato la password troppe volte. Riprova tra un'ora.",
      corsHeaders,
    });
    if (limited) return limited;

    if (decodeClaims(token).aal !== "aal2" && await hasVerifiedFactor(admin, user.id)) {
      return mfaRequiredResponse(corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const childId = typeof body?.childId === "string" ? body.childId : "";
    const newPassword = body?.newPassword;
    if (!childId) return json({ error: "Figlio non indicato" }, 400);

    const invalid = validateChildPassword(newPassword);
    if (invalid) return json({ error: invalid }, 400);

    const { data: child } = await admin
      .from("profiles")
      .select("id, full_name, parent_id, role")
      .eq("id", childId)
      .maybeSingle();
    // Stessa risposta se il figlio non esiste o non è suo: non rivela altri account
    if (!child || child.parent_id !== user.id || child.role !== "student") {
      return json({ error: "Puoi cambiare solo la password dei tuoi figli" }, 403);
    }

    const { data: childAuth, error: childAuthError } = await admin.auth.admin.updateUserById(childId, {
      password: newPassword as string,
    });
    if (childAuthError) {
      if (isWeakPasswordError(childAuthError)) return json({ error: WEAK_PASSWORD_MESSAGE }, 400);
      console.error("[parent-set-child-password] update:", childAuthError.message);
      return json({ error: "Impossibile aggiornare la password. Riprova più tardi." }, 500);
    }

    const now = new Date().toISOString();
    const { error: settingsError } = await admin.from("student_password_settings").upsert({
      student_id: childId,
      own_password: true,
      set_by: user.id,
      set_at: now,
      updated_at: now,
    });
    if (settingsError) {
      // La password è cambiata comunque; senza la riga il figlio resta "legacy"
      console.error("[parent-set-child-password] settings:", settingsError.message);
    }

    const childEmail = childAuth.user?.email?.toLowerCase();
    if (childEmail) {
      const { error: unlockError } = await admin
        .from("login_attempts")
        .delete()
        .eq("email", childEmail)
        .eq("success", false);
      if (unlockError) console.error("[parent-set-child-password] unlock:", unlockError.message);
    }

    console.log(`[parent-set-child-password] genitore ${user.id} → figlio ${childId}`);
    return json({ success: true });
  } catch (error) {
    console.error("[parent-set-child-password]", error);
    return json({ error: "Errore interno del server" }, 500);
  }
});

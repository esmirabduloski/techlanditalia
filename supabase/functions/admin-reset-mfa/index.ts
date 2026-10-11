/**
 * Reset della verifica in due passaggi di un utente da parte di un admin
 * (es. telefono perso). Usa l'API admin nativa di Supabase: elimina i fattori
 * con auth.admin.mfa.deleteFactor, che disconnette anche tutte le sessioni
 * dell'utente. Al login successivo l'utente configura una nuova app.
 *
 * Conferme richieste all'admin:
 *   - sessione aal2;
 *   - codice dell'app di autenticazione reinserito negli ultimi 5 minuti
 *     (claim amr "totp"), quindi una sessione rubata/lasciata aperta non basta.
 * L'utente riceve un'email che lo avvisa del reset.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, hasRecentAuth } from "../_shared/mfa.ts";
import { sendSecurityEmail } from "../_shared/securityemail.ts";

const BodySchema = z.object({
  userId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const limited = await rateLimit(req, { endpoint: "admin-reset-mfa", maxRequests: 20, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin possono reimpostare la 2FA" }, 403);

    const claims = decodeClaims(token);
    if (claims.aal !== "aal2") return json({ error: "Verifica in due passaggi richiesta", mfa_required: true }, 403);
    if (!hasRecentAuth(claims, ["totp"], 5 * 60)) {
      return json({ error: "Conferma con il codice della tua app di autenticazione", step_up_required: true }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dati non validi" }, 400);
    const { userId, note } = parsed.data;

    if (userId === user.id) {
      return json({ error: "Non puoi reimpostare la tua 2FA: gestiscila da Sicurezza account o chiedi a un altro admin" }, 400);
    }

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || !target?.user) return json({ error: "Utente non trovato" }, 404);

    const { data: factorsData, error: listError } = await admin.auth.admin.mfa.listFactors({ userId });
    if (listError) {
      console.error("[admin-reset-mfa] listFactors:", listError);
      return json({ error: "Impossibile leggere i fattori dell'utente" }, 500);
    }
    const factors = factorsData?.factors ?? [];

    for (const factor of factors) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
      if (error) {
        console.error(`[admin-reset-mfa] deleteFactor ${factor.id}:`, error);
        return json({ error: "Impossibile rimuovere uno dei fattori" }, 500);
      }
    }

    const now = new Date().toISOString();
    await admin
      .from("mfa_reset_requests")
      .update({ status: "completed", resolved_at: now, resolved_by: user.id, note: note || null })
      .eq("user_id", userId)
      .eq("status", "pending");

    await admin.from("admin_access_logs").insert({
      admin_id: user.id,
      action: "mfa_reset",
      path: "/admin/utenti",
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
      metadata: { target_user_id: userId, removed_factors: factors.length, note: note || null },
    });

    let emailSent = false;
    if (target.user.email) {
      emailSent = await sendSecurityEmail(
        target.user.email,
        "La verifica in due passaggi è stata reimpostata - TECHLAND",
        "Verifica in due passaggi reimpostata",
        `<p>Un amministratore di TECHLAND ha reimpostato la verifica in due passaggi del tuo account, come da tua richiesta.</p>
         <p>Tutte le sessioni aperte sono state chiuse. Al prossimo accesso con email e password ti verrà chiesto di configurare di nuovo un'app di autenticazione.</p>`,
      );
    }

    console.log(`[admin-reset-mfa] ${factors.length} fattori rimossi per ${userId} da ${user.id}`);
    return json({ success: true, removedFactors: factors.length, emailSent });
  } catch (error) {
    console.error("[admin-reset-mfa]", error);
    return json({ error: "Errore interno del server" }, 500);
  }
});

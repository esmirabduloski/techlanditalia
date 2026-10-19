/**
 * Recupero 2FA per chi ha perso l'app di autenticazione.
 *
 * Il self-service NON rimuove la 2FA (altrimenti basterebbe password + email
 * per aggirarla): crea solo una richiesta che un admin deve approvare dal
 * pannello Utenti (edge function admin-reset-mfa).
 *
 *   send-code  -> codice monouso via email (generateLink nativo di Supabase,
 *                 inviato con Resend come le altre email del sito)
 *   submit     -> richiede che la sessione sia stata confermata con quel codice
 *                 (supabase.auth.verifyOtp lato client, claim amr "otp")
 *                 negli ultimi 15 minuti, poi registra la richiesta e avvisa
 *                 gli admin.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { decodeClaims, hasRecentAuth, hasVerifiedFactor } from "../_shared/mfa.ts";
import { sendSecurityEmail } from "../_shared/securityemail.ts";
import { mfaCodeEmail } from "../_shared/emailtemplates.ts";

const BodySchema = z.object({
  action: z.enum(["send-code", "submit"]),
  note: z.string().trim().max(500).optional(),
});

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.email) return json({ error: "Non autorizzato" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dati non validi" }, 400);
    const { action, note } = parsed.data;

    if (!(await hasVerifiedFactor(admin, user.id))) {
      return json({ error: "La verifica in due passaggi non è attiva su questo account" }, 400);
    }

    if (action === "send-code") {
      const limited = await rateLimit(req, {
        endpoint: "mfa-recovery-code",
        identifier: user.id,
        maxRequests: 5,
        windowSeconds: 3600,
        corsHeaders,
      });
      if (limited) return limited;

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
      const code = data?.properties?.email_otp;
      if (error || !code) {
        console.error("[mfa-recovery] generateLink:", error);
        return json({ error: "Impossibile generare il codice" }, 500);
      }
      const sent = await sendSecurityEmail("security_mfa_code", "mfa-recovery", user.email, mfaCodeEmail(code), user.id);
      if (!sent) return json({ error: "Impossibile inviare l'email" }, 500);
      return json({ success: true });
    }

    // submit
    const limited = await rateLimit(req, {
      endpoint: "mfa-recovery-submit",
      identifier: user.id,
      maxRequests: 5,
      windowSeconds: 3600,
      corsHeaders,
    });
    if (limited) return limited;

    if (!hasRecentAuth(decodeClaims(token), ["otp", "magiclink"], 15 * 60)) {
      return json({ error: "Conferma prima il codice ricevuto via email", email_code_required: true }, 403);
    }

    const { data: existing } = await admin
      .from("mfa_reset_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return json({ success: true, alreadyPending: true });

    const { error: insertError } = await admin
      .from("mfa_reset_requests")
      .insert({ user_id: user.id, note: note || null });
    if (insertError) {
      console.error("[mfa-recovery] insert:", insertError);
      return json({ error: "Impossibile registrare la richiesta" }, 500);
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    await notifyAdmins({
      title: "Richiesta reset 2FA",
      body: `${profile?.full_name || user.email} ha perso l'accesso all'app di autenticazione.`,
      path: "/admin/utenti?mfa=pending",
      type: "mfa_reset_request",
      tag: `mfa-reset-${user.id}`,
    });

    return json({ success: true });
  } catch (error) {
    console.error("[mfa-recovery]", error);
    return json({ error: "Errore interno del server" }, 500);
  }
});

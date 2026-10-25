import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { validateChildPassword } from "../_shared/studentpassword.ts";
import { ACCOUNT_TRASH_DAYS, trashAccount } from "../_shared/accounttrash.ts";

const BodySchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6).max(200).optional(),
  action: z.enum(["delete", "update"]).optional(),
});


serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "admin-set-password", maxRequests: 20, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Solo gli admin possono modificare le password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gli admin operano solo con la verifica in due passaggi completata (sessione aal2)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { userId, newPassword, action } = parsed.data;

    // Handle delete action
    if (action === 'delete') {
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId mancante" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deleting yourself
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Non puoi eliminare il tuo stesso account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Nel Cestino per 30 giorni (migrazione 0076): login bloccato, profilo e
      // dati collegati (con i figli di un genitore) ripristinabili, file nello
      // storage lasciati dove sono. Li elimina per sempre purge-deleted-accounts.
      const trashed = await trashAccount(supabaseAdmin, userId, user.id);
      if (!trashed.ok) {
        console.error(`Error trashing user ${userId}:`, trashed.message);
        const error = trashed.reason === "not_found"
          ? "Utente non trovato: forse è già nel Cestino"
          : trashed.reason === "not_ready"
          ? "Il cestino degli account non è ancora attivo (migrazione 0076 da applicare): nessun dato è stato eliminato"
          : "Impossibile eliminare l'utente";
        return new Response(JSON.stringify({ error }), {
          status: trashed.reason === "not_found" ? 404 : trashed.reason === "not_ready" ? 503 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`User ${userId} moved to trash by admin ${user.id} (batch ${trashed.batchId})`);

      return new Response(JSON.stringify({ success: true, batchId: trashed.batchId, recoverableDays: ACCOUNT_TRASH_DAYS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle password update (default action)
    if (!userId || !newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Password non valida (minimo 6 caratteri)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's profile to check if it's a parent
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Utente non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stesse regole del pannello genitore per la password dello studente
    const invalidStudentPassword = profile.role === 'student' ? validateChildPassword(newPassword) : null;
    if (invalidStudentPassword) {
      return new Response(JSON.stringify({ error: invalidStudentPassword }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password in auth.users
    const { data: updatedAuth, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (authUpdateError) {
      console.error("Error updating auth password:", authUpdateError);
      return new Response(JSON.stringify({ error: "Impossibile aggiornare la password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Le password di genitore e figli sono separate (migrazione
    // 0046_student_passwords): cambiare quella del genitore non tocca i figli.
    // Per uno studente la nuova password diventa la sua, senza più il
    // fallback sulla password del genitore, e si sblocca il login.
    if (profile.role === 'student') {
      const now = new Date().toISOString();
      const { error: settingsError } = await supabaseAdmin
        .from('student_password_settings')
        .upsert({ student_id: userId, own_password: true, set_by: user.id, set_at: now, updated_at: now });
      if (settingsError) {
        console.error("Error saving student password settings:", settingsError);
      }

      const studentEmail = updatedAuth.user?.email?.toLowerCase();
      if (studentEmail) {
        const { error: unlockError } = await supabaseAdmin
          .from('login_attempts')
          .delete()
          .eq('email', studentEmail)
          .eq('success', false);
        if (unlockError) console.error("Error clearing student login attempts:", unlockError);
      }
    }

    console.log(`Password updated for user ${userId} by admin ${user.id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

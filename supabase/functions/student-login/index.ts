import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { clientIp } from "../_shared/clientip.ts";
import { parentFallbackAllowed } from "../_shared/studentpassword.ts";

// Login alunno con username: tentativi errati consentiti prima del blocco temporaneo
const STUDENT_MAX_ATTEMPTS = 10;
const STUDENT_LOCK_MINUTES = 15;


serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const rawIp = clientIp(req);
  const ip = rawIp === "unknown" ? null : rawIp;

  let emailForLog: string | null = null;

  const recordAttempt = async (success: boolean) => {
    if (!emailForLog) return;
    try {
      await supabaseAdmin.from("login_attempts").insert({
        email: emailForLog,
        ip_address: ip,
        success,
      });
    } catch (e) {
      console.error("login_attempts insert failed:", e);
    }
  };

  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: "Credenziali richieste" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedIdentifier = identifier.trim();
    const isEmail = trimmedIdentifier.includes("@");

    if (isEmail) {
      emailForLog = trimmedIdentifier.toLowerCase();

      // Server-side rate limiting check (cannot be spoofed by clients)
      const { data: rl } = await supabaseAdmin.rpc("check_login_rate_limit", {
        _email: emailForLog,
        _max_attempts: 5,
        _window_minutes: 15,
      });
      if (rl && (rl as any).blocked) {
        return new Response(JSON.stringify({
          error: "Troppi tentativi falliti. Riprova più tardi.",
          blocked: true,
          retry_after_seconds: (rl as any).retry_after_seconds,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Login attempt: ${trimmedIdentifier} (${isEmail ? "email" : "username"})`);

    if (isEmail) {
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: trimmedIdentifier,
        password,
      });

      if (signInError) {
        await recordAttempt(false);
        return new Response(JSON.stringify({ error: "Email o password non corretti" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await recordAttempt(true);
      return new Response(JSON.stringify({ session: signInData.session }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Username login - find the student profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, parent_id, email")
      .eq("username", trimmedIdentifier)
      .eq("role", "student")
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: studentAuthUser, error: studentAuthError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (studentAuthError || !studentAuthUser.user) {
      return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    emailForLog = studentAuthUser.user.email?.toLowerCase() ?? null;

    // Blocco temporaneo dopo troppi errori, contati sull'account dell'alunno
    if (emailForLog) {
      const { data: rl } = await supabaseAdmin.rpc("check_login_rate_limit", {
        _email: emailForLog,
        _max_attempts: STUDENT_MAX_ATTEMPTS,
        _window_minutes: STUDENT_LOCK_MINUTES,
      });
      if (rl && (rl as any).blocked) {
        const minutes = Math.max(1, Math.ceil(((rl as any).retry_after_seconds ?? 60) / 60));
        return new Response(JSON.stringify({
          error: `Hai sbagliato la password ${STUDENT_MAX_ATTEMPTS} volte. Riprova tra ${minutes} minuti oppure chiedi al tuo genitore di impostare una nuova password dalla sua area riservata.`,
          blocked: true,
          retry_after_seconds: (rl as any).retry_after_seconds,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: studentAuthUser.user.email!,
      password,
    });

    if (!signInError) {
      await recordAttempt(true);
      return new Response(JSON.stringify({ session: signInData.session }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gli studenti senza password propria (drizzle/migrations/0046_student_passwords.sql)
    // entrano anche con quella del genitore, senza scadenza.
    let fallbackAllowed = false;
    if (profile.parent_id) {
      const { data: pwSettings, error: pwSettingsError } = await supabaseAdmin
        .from("student_password_settings")
        .select("own_password")
        .eq("student_id", profile.id)
        .maybeSingle();
      // Tabella non ancora creata o errore di lettura: si tratta come legacy
      if (pwSettingsError) console.error("student_password_settings read failed:", pwSettingsError.message);
      fallbackAllowed = parentFallbackAllowed(pwSettingsError ? null : pwSettings);
    }

    if (profile.parent_id && fallbackAllowed) {
      const { data: parentAuthUser, error: parentAuthError } = await supabaseAdmin.auth.admin.getUserById(profile.parent_id);

      if (!parentAuthError && parentAuthUser.user) {
        const { error: parentSignInError } = await supabaseAdmin.auth.signInWithPassword({
          email: parentAuthUser.user.email!,
          password,
        });

        if (!parentSignInError) {
          await supabaseAdmin.auth.admin.updateUserById(profile.id, { password });

          const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
            email: studentAuthUser.user.email!,
            password,
          });

          if (!retryError) {
            console.log(`Student ${profile.id} logged in with the parent's password (legacy)`);
            const now = new Date().toISOString();
            const { error: trackError } = await supabaseAdmin.from("student_password_settings").upsert({
              student_id: profile.id,
              own_password: false,
              parent_fallback_used_at: now,
              updated_at: now,
            });
            if (trackError) console.error("student_password_settings track failed:", trackError.message);
            await recordAttempt(true);
            return new Response(JSON.stringify({ session: retryData.session }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    await recordAttempt(false);
    return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
      status: 401,
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

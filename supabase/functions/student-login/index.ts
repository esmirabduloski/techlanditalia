import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip") || null;

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

    if (profile.parent_id) {
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

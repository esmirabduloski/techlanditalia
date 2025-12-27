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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username e password richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Student login attempt for username: ${username}`);

    // Find the student profile by username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, plain_password')
      .eq('username', username.trim())
      .eq('role', 'student')
      .maybeSingle();

    if (profileError || !profile) {
      console.log("Profile not found for username:", username);
      return new Response(JSON.stringify({ error: "Nome utente non trovato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plain password
    if (profile.plain_password !== password) {
      console.log("Invalid password for username:", username);
      return new Response(JSON.stringify({ error: "Password non corretta" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the auth user details
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (authError || !authUser.user) {
      console.error("Error getting auth user:", authError);
      return new Response(JSON.stringify({ error: "Utente non trovato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign in the user using the stored email and password
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authUser.user.email!,
      password: password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
      // If the stored password doesn't match, update it
      if (signInError.message.includes('Invalid login credentials')) {
        // Update the auth password to match the plain password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          password: password,
        });
        
        if (updateError) {
          console.error("Error updating password:", updateError);
          return new Response(JSON.stringify({ error: "Impossibile effettuare il login" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Try signing in again
        const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
          email: authUser.user.email!,
          password: password,
        });
        
        if (retryError) {
          return new Response(JSON.stringify({ error: "Impossibile effettuare il login" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        console.log(`Student logged in successfully: ${username}`);
        return new Response(JSON.stringify({ session: retryData.session }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Impossibile effettuare il login" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Student logged in successfully: ${username}`);

    return new Response(JSON.stringify({ session: signInData.session }), {
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
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
      .select('id, parent_id')
      .eq('username', username.trim())
      .eq('role', 'student')
      .maybeSingle();

    if (profileError || !profile) {
      console.log("Profile not found for username:", username);
      return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the student's auth user to get their email
    const { data: studentAuthUser, error: studentAuthError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (studentAuthError || !studentAuthUser.user) {
      console.error("Error getting student auth user:", studentAuthError);
      return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Student uses the same password as parent, stored in auth.users
    // Try to sign in the student directly with the provided password
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: studentAuthUser.user.email!,
      password: password,
    });

    if (signInError) {
      console.log("Direct student login failed, password may have changed. Checking parent...");
      
      // If direct login fails and student has a parent, maybe parent changed password
      // We need to update student's password to match parent's
      if (profile.parent_id) {
        // Get parent's auth user
        const { data: parentAuthUser, error: parentAuthError } = await supabaseAdmin.auth.admin.getUserById(profile.parent_id);
        
        if (!parentAuthError && parentAuthUser.user) {
          // Try to verify the password using parent's account
          const { error: parentSignInError } = await supabaseAdmin.auth.signInWithPassword({
            email: parentAuthUser.user.email!,
            password: password,
          });
          
          if (!parentSignInError) {
            // Password is correct for parent, update student's password to match
            console.log("Parent password verified, updating student password to match...");
            
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
              password: password,
            });
            
            if (updateError) {
              console.error("Error updating student password:", updateError);
              return new Response(JSON.stringify({ error: "Impossibile effettuare il login" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            
            // Now try to sign in the student again
            const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
              email: studentAuthUser.user.email!,
              password: password,
            });
            
            if (retryError) {
              console.error("Retry sign in failed:", retryError);
              return new Response(JSON.stringify({ error: "Impossibile effettuare il login" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            
            console.log(`Student logged in successfully after password sync: ${username}`);
            return new Response(JSON.stringify({ session: retryData.session }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
      
      // If we get here, password is wrong
      console.log("Invalid password for username:", username);
      return new Response(JSON.stringify({ error: "Nome utente o password non corretti" }), {
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

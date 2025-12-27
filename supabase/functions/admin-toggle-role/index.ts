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
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization")!;
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
      return new Response(JSON.stringify({ error: "Solo gli admin possono modificare i ruoli" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, action } = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      // Add admin role
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (error && !error.message.includes("duplicate")) {
        console.error("Error adding admin role:", error);
        return new Response(JSON.stringify({ error: "Impossibile aggiungere il ruolo admin" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (action === "remove") {
      // Remove admin role
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        console.error("Error removing admin role:", error);
        return new Response(JSON.stringify({ error: "Impossibile rimuovere il ruolo admin" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Admin role ${action}ed for user ${userId} by admin ${user.id}`);

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const BodySchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6).max(200).optional(),
  action: z.enum(["delete", "update"]).optional(),
});

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

      // Get user's profile to check if it's a parent with children
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role === 'parent') {
        // Get children
        const { data: children } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('parent_id', userId)
          .eq('role', 'student');

        // Delete children first
        if (children && children.length > 0) {
          for (const child of children) {
            const { error: childDeleteError } = await supabaseAdmin.auth.admin.deleteUser(child.id);
            if (childDeleteError) {
              console.error(`Error deleting child ${child.id}:`, childDeleteError);
            }
          }
          console.log(`Deleted ${children.length} children of parent ${userId}`);
        }
      }

      // Delete the user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error("Error deleting user:", deleteError);
        return new Response(JSON.stringify({ error: "Impossibile eliminare l'utente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`User ${userId} deleted by admin ${user.id}`);

      return new Response(JSON.stringify({ success: true }), {
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

    // Update password in auth.users for the parent
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (authUpdateError) {
      console.error("Error updating auth password:", authUpdateError);
      return new Response(JSON.stringify({ error: "Impossibile aggiornare la password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If this is a parent, also update all children's passwords
    if (profile.role === 'parent') {
      const { data: children } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('parent_id', userId)
        .eq('role', 'student');

      if (children && children.length > 0) {
        for (const child of children) {
          const { error: childUpdateError } = await supabaseAdmin.auth.admin.updateUserById(child.id, {
            password: newPassword,
          });
          if (childUpdateError) {
            console.error(`Error updating child ${child.id} password:`, childUpdateError);
          }
        }
        console.log(`Updated password for ${children.length} children of parent ${userId}`);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  parentId: z.string().uuid(),
  childIds: z.array(z.string().uuid()).max(50),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Solo gli admin possono assegnare figli" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { parentId, childIds } = parsed.data;

    const { data: parent, error: parentError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", parentId)
      .eq("role", "parent")
      .maybeSingle();

    if (parentError || !parent) {
      return new Response(JSON.stringify({ error: "Genitore non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (childIds.length > 0) {
      const { data: children, error: childrenError } = await supabaseAdmin
        .from("profiles")
        .select("id, role, parent_id")
        .in("id", childIds);

      if (childrenError) {
        return new Response(JSON.stringify({ error: "Impossibile verificare gli alunni" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validChildIds = new Set(
        (children ?? [])
          .filter((child) => child.role === "student" && (!child.parent_id || child.parent_id === parentId))
          .map((child) => child.id),
      );

      if (validChildIds.size !== childIds.length) {
        return new Response(JSON.stringify({ error: "Uno o più alunni non sono assegnabili" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: unassignError } = await supabaseAdmin
      .from("profiles")
      .update({ parent_id: null })
      .eq("parent_id", parentId)
      .not("id", "in", `(${childIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);

    if (unassignError) {
      return new Response(JSON.stringify({ error: "Impossibile aggiornare i figli" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (childIds.length > 0) {
      const { error: assignError } = await supabaseAdmin
        .from("profiles")
        .update({ parent_id: parentId })
        .in("id", childIds);

      if (assignError) {
        return new Response(JSON.stringify({ error: "Impossibile associare gli alunni" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
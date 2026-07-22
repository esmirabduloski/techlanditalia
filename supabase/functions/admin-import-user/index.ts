import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ChildSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  username: z.string().trim().min(1).max(50),
  courseId: z.string().uuid().optional().nullable(),
});

const BodySchema = z.object({
  role: z.enum(["parent", "teacher"]),
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128).optional(),
  children: z.array(ChildSchema).max(20).optional(),
});

function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function sanitizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", adminUser.id).eq("role", "admin").maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Solo gli admin possono importare utenti" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { role, fullName, email, children } = parsed.data;
    const password = parsed.data.password || randomPassword();
    const cleanEmail = email.toLowerCase();

    // Check duplicate email
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("id").eq("email", cleanEmail).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: `Email già registrata: ${cleanEmail}`, skipped: true }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create main user
    const userRole = role === "parent" ? "parent" : "teacher";
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail, password, email_confirm: true,
      user_metadata: { full_name: fullName, role: userRole },
    });
    if (createError || !authData?.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Impossibile creare l'account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newUserId = authData.user.id;

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId, full_name: fullName, email: cleanEmail, role: userRole,
    }, { onConflict: "id" });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Impossibile creare il profilo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "teacher") {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "teacher" });
      await supabaseAdmin.from("teacher_profiles").insert({ user_id: newUserId });
    } else {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "user" });
    }

    const createdChildren: { id: string; fullName: string; username: string }[] = [];
    if (role === "parent" && children && children.length > 0) {
      for (const child of children) {
        const cleanUsername = sanitizeUsername(child.username);
        if (!cleanUsername) continue;

        const { data: dupUser } = await supabaseAdmin
          .from("profiles").select("id").eq("username", cleanUsername).maybeSingle();
        if (dupUser) {
          console.warn(`Username già in uso, salto: ${cleanUsername}`);
          continue;
        }

        const childEmail = `${cleanUsername}_${Date.now()}${Math.floor(Math.random() * 999)}@student.techland.local`;
        const { data: childAuth, error: childErr } = await supabaseAdmin.auth.admin.createUser({
          email: childEmail, password, email_confirm: true,
          user_metadata: { full_name: child.fullName, role: "student" },
        });
        if (childErr || !childAuth?.user) {
          console.error("Errore creazione figlio:", childErr);
          continue;
        }
        await supabaseAdmin.from("profiles").upsert({
          id: childAuth.user.id, full_name: child.fullName, email: childEmail,
          role: "student", username: cleanUsername, parent_id: newUserId,
        }, { onConflict: "id" });

        if (child.courseId) {
          await supabaseAdmin.from("enrollments").insert({
            student_id: childAuth.user.id, course_id: child.courseId, status: "active",
          });
        }
        createdChildren.push({ id: childAuth.user.id, fullName: child.fullName, username: cleanUsername });
      }
    }

    return new Response(JSON.stringify({
      success: true, userId: newUserId, email: cleanEmail, password, children: createdChildren,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

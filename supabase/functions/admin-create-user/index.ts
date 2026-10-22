import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { addParentRole, createAdultAccount, createChildAccount, sendWelcomeEmail } from "../_shared/familyaccounts.ts";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "admin-create-user", maxRequests: 20, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");

    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Solo gli admin possono creare utenti" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gli admin operano solo con la verifica in due passaggi completata (sessione aal2)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const { role, email, password, fullName, childName, childUsername, courseId } = await req.json();

    if (!role || !email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "Dati mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role !== "parent" && role !== "teacher") {
      return new Response(JSON.stringify({ error: "Ruolo non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For parent, child data is required
    if (role === "parent" && (!childName || !childUsername)) {
      return new Response(JSON.stringify({ error: "Dati del figlio obbligatori per il genitore" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check child username uniqueness if parent
    if (role === "parent") {
      const { data: existingUser } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", childUsername.trim())
        .maybeSingle();

      if (existingUser) {
        return new Response(JSON.stringify({ error: "Username del figlio già in uso" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Admin ${adminUser.id} creating ${role} account: ${email}`);

    const clients = {
      admin: supabaseAdmin,
      asAdmin: createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };

    // Create the user account
    const userRole = role === "parent" ? "parent" : "teacher";
    const account = await createAdultAccount(clients, { email, password, fullName, role: userRole });
    if (!account.ok) {
      return new Response(JSON.stringify({ error: account.error }), {
        status: account.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newUserId = account.userId;

    // Add role to user_roles table
    if (role === "teacher") {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "teacher" });
      if (roleError) {
        console.error("Error adding teacher role:", roleError);
      }

      // Create teacher profile
      const { error: tpError } = await supabaseAdmin
        .from("teacher_profiles")
        .insert({ user_id: newUserId });
      if (tpError) {
        console.error("Error creating teacher profile:", tpError);
      }
    }

    // For parent role, add 'user' role and create child account
    if (role === "parent") {
      await addParentRole(supabaseAdmin, newUserId);

      const child = await createChildAccount(supabaseAdmin, {
        parentId: newUserId,
        childName,
        childUsername,
        courseIds: courseId && courseId !== "none" ? [courseId] : [],
      });

      if (!child.ok && child.stage === "auth") {
        return new Response(JSON.stringify({ error: "Account genitore creato ma errore nella creazione del figlio" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!child.ok) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: "Account genitore creato ma non è stato possibile associare il figlio. Riprova o contatta supporto." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send welcome email (with a one-time password setup link instead of the plaintext password)
    await sendWelcomeEmail(req, clients, {
      userId: newUserId,
      email,
      fullName,
      role: userRole,
      childName: role === "parent" ? childName : undefined,
      childUsername: role === "parent" ? childUsername : undefined,
    });

    console.log(`Account created successfully: ${newUserId} (${role})`);

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
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

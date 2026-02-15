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

    // Create the user account
    const userRole = role === "parent" ? "parent" : "teacher";
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: userRole,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      const msg = createError.message.includes("already been registered")
        ? "Questa email è già registrata"
        : "Impossibile creare l'account";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

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
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "user" });
      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Error adding user role:", roleError);
      }

      // Create child account
      const childEmail = `${childUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}@student.techland.local`;

      const { data: childAuthData, error: childAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: childEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: childName.trim(),
          role: "student",
        },
      });

      if (childAuthError) {
        console.error("Error creating child account:", childAuthError);
        return new Response(JSON.stringify({ error: "Account genitore creato ma errore nella creazione del figlio" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update child profile
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          username: childUsername.trim(),
          parent_id: newUserId,
        })
        .eq("id", childAuthData.user.id);

      if (profileError) {
        console.error("Error updating child profile:", profileError);
      }

      // Enroll child in course if selected
      if (courseId && courseId !== "none") {
        const { error: enrollError } = await supabaseAdmin
          .from("enrollments")
          .insert({
            student_id: childAuthData.user.id,
            course_id: courseId,
            status: "active",
          });
        if (enrollError) {
          console.error("Error creating enrollment:", enrollError);
        }
      }
    }

    // Send welcome email
    try {
      const welcomeBody: Record<string, string> = {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role: userRole,
      };
      if (role === "parent" && childName && childUsername) {
        welcomeBody.childName = childName.trim();
        welcomeBody.childUsername = childUsername.trim();
      }

      // Use anon key client to invoke edge function
      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
      await supabaseAnon.functions.invoke("send-welcome-email", { body: welcomeBody });
    } catch (err) {
      console.error("Welcome email error:", err);
    }

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

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
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authenticatedUserId = claimsData.claims.sub;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { parentId, childName, childUsername, childPassword, courseId } = await req.json();

    // childPassword is now the parent's password
    if (!parentId || !childName || !childUsername || !childPassword) {
      return new Response(JSON.stringify({ error: "Dati mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the authenticated user matches the parentId
    if (authenticatedUserId !== parentId) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating child account for parent ${parentId}: ${childName} (${childUsername})`);

    // Check if username already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', childUsername)
      .maybeSingle();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Username già in uso" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a dummy auth user for the child with a random email
    // The child uses the same password as the parent
    const childEmail = `${childUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@student.techland.local`;
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: childEmail,
      password: childPassword, // Same as parent's password
      email_confirm: true,
      user_metadata: {
        full_name: childName,
        role: 'student',
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return new Response(JSON.stringify({ error: "Impossibile creare l'account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the profile with username and parent_id (no plain_password anymore)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        username: childUsername,
        parent_id: parentId,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // If a course was selected, create enrollment
    if (courseId && courseId !== 'none') {
      const { error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .insert({
          student_id: authData.user.id,
          course_id: courseId,
          status: 'active',
        });

      if (enrollError) {
        console.error("Error creating enrollment:", enrollError);
      }
    }

    console.log(`Child account created successfully: ${authData.user.id}`);

    return new Response(JSON.stringify({ success: true, childId: authData.user.id }), {
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

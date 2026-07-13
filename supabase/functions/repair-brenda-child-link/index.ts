import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PARENT_ID = "ebccd5f3-8f71-4468-b3d6-ecb8487def38";
const CHILD_ID = "70a9f082-7c36-4f22-b517-a6119c6b5d57";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: parentAuth, error: parentAuthError } = await supabase.auth.admin.getUserById(PARENT_ID);
  const { data: childAuth, error: childAuthError } = await supabase.auth.admin.getUserById(CHILD_ID);

  if (parentAuthError || !parentAuth.user || childAuthError || !childAuth.user) {
    return new Response(JSON.stringify({
      error: "Auth users not found in this environment",
      parentFound: Boolean(parentAuth?.user),
      childFound: Boolean(childAuth?.user),
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: parentProfileError } = await supabase.from("profiles").upsert({
    id: PARENT_ID,
    full_name: "Brenda Ternida",
    email: parentAuth.user.email ?? "jherendson07@gmail.com",
    role: "parent",
  }, { onConflict: "id" });

  if (parentProfileError) {
    return new Response(JSON.stringify({ error: parentProfileError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: childProfileError } = await supabase.from("profiles").upsert({
    id: CHILD_ID,
    full_name: "Francis",
    email: childAuth.user.email ?? "francis_1783957993162@student.techland.local",
    username: "francis",
    role: "student",
    parent_id: PARENT_ID,
  }, { onConflict: "id" });

  if (childProfileError) {
    return new Response(JSON.stringify({ error: childProfileError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("user_roles").upsert({ user_id: PARENT_ID, role: "user" }, { onConflict: "user_id,role" });

  return new Response(JSON.stringify({ success: true, parentId: PARENT_ID, childId: CHILD_ID }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
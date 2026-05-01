import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  // 'check' = solo verifica blocco; 'record' = registra esito di un tentativo
  action: z.enum(["check", "record"]).default("check"),
  success: z.boolean().optional(),
});

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.json();
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { email, action, success } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || null;

    if (action === "record") {
      await supabase.from("login_attempts").insert({
        email,
        ip_address: ip,
        success: success === true,
      });
      return new Response(JSON.stringify({ recorded: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // action === "check"
    const { data, error } = await supabase.rpc("check_login_rate_limit", {
      _email: email,
      _max_attempts: 5,
      _window_minutes: 15,
    });
    if (error) {
      console.error("rpc error", error);
      return new Response(JSON.stringify({ blocked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(data || { blocked: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal error", blocked: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Schema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  telefono: z.string().trim().max(40).optional().or(z.literal("")),
  posizione: z.string().trim().min(2).max(150),
  messaggio: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional().or(z.literal("")),
  formOpenedAt: z.number().optional(),
});

const BOT_UA = /(curl|wget|python-requests|scrapy|httpclient|go-http-client|java\/|libwww|httrack|nikto|sqlmap|nmap|masscan|zgrab|acunetix|nessus|burpsuite)/i;

function getIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "unknown";
}

async function logEvent(supabase: any, e: Record<string, unknown>) {
  try { await supabase.from("security_events").insert(e); } catch (err) { console.error("[sec-log]", err); }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") || "";

  if (!ua || BOT_UA.test(ua)) {
    await logEvent(supabase, { event_type: "bot_ua_blocked", ip_address: ip, user_agent: ua, endpoint: "submit-job-application", severity: "warn" });
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const { data: rl } = await supabase.rpc("check_rate_limit", {
    _identifier: ip, _endpoint: "submit-job-application", _max_requests: 3, _window_seconds: 3600,
  });
  if (rl && rl.allowed === false) {
    await logEvent(supabase, { event_type: "rate_limit_exceeded", ip_address: ip, user_agent: ua, endpoint: "submit-job-application", severity: "warn" });
    return new Response(JSON.stringify({ error: "Troppe richieste, riprova più tardi." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders, "Retry-After": String(rl.retry_after_seconds || 3600) } });
  }

  try {
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { nome, email, telefono, posizione, messaggio, website, formOpenedAt } = parsed.data;

    if (website && website.length > 0) {
      await logEvent(supabase, { event_type: "honeypot_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "submit-job-application", severity: "warn" });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (formOpenedAt && (Date.now() - formOpenedAt) < 2000) {
      await logEvent(supabase, { event_type: "time_trap_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "submit-job-application", severity: "warn" });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: blocked } = await supabase.rpc("is_email_blocked", { _email: email });
    if (blocked === true) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { error } = await supabase.from("job_applications").insert({
      nome, email, telefono: telefono || null, posizione, messaggio,
    });
    if (error) {
      console.error("[job-app] insert", error);
      return new Response(JSON.stringify({ error: "Errore nell'invio" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("[job-app]", err);
    return new Response(JSON.stringify({ error: "Errore interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});

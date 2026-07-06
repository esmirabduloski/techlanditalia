import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod schema with built-in honeypot + time-trap validation
const BookingSchema = z.object({
  parentName: z.string().trim().min(2).max(100)
    .refine((v) => !/<script|javascript:|data:/i.test(v), "Caratteri non validi"),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(1).max(20)
    .regex(/^[\d\s+\-()]*$/, "Numero non valido"),
  childAge: z.number().int().min(5).max(20).nullable().optional(),
  interest: z.string().max(100).nullable().optional(),
  availability: z.enum(["mattina","pomeriggio","sera","weekend","qualsiasi"]).optional(),
  message: z.string().max(1000).optional(),
  adminEmail: z.string().email().optional(),
  // Honeypot: deve restare vuoto
  website: z.string().max(0).optional().or(z.literal("")),
  // Time-trap: timestamp apertura form (ms da epoch)
  formOpenedAt: z.number().optional(),
});

const BOT_UA_PATTERNS = /(curl|wget|python-requests|scrapy|httpclient|go-http-client|java\/|libwww|httrack|nikto|sqlmap|nmap|masscan|zgrab|acunetix|nessus|burpsuite)/i;

function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

async function logSecurityEvent(supabase: any, event: {
  event_type: string; identifier?: string; ip_address?: string; user_agent?: string;
  endpoint?: string; severity?: string; metadata?: Record<string, unknown>;
}) {
  try { await supabase.from("security_events").insert(event); } catch (e) { console.error("[sec-log]", e); }
}

function sendNotificationInBackground(payload: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const notificationTask = fetch(`${supabaseUrl}/functions/v1/send-booking-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      await response.text();
      if (!response.ok) {
        console.error("[submit-booking] notification email failed with status:", response.status);
      }
    })
    .catch((error) => {
      console.error("[submit-booking] notification email failed:", error);
    })
    .finally(() => clearTimeout(timeout));

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(notificationTask);
  } else {
    notificationTask.catch(() => undefined);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Block obvious bots / scripted clients
  if (!ua || BOT_UA_PATTERNS.test(ua)) {
    await logSecurityEvent(supabase, { event_type: "bot_ua_blocked", ip_address: ip, user_agent: ua, endpoint: "submit-booking", severity: "warn" });
    return new Response(JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Rate limit: max 3 per IP per hour
  const { data: rl } = await supabase.rpc("check_rate_limit", {
    _identifier: ip, _endpoint: "submit-booking", _max_requests: 15, _window_seconds: 3600,
  });
  if (rl && rl.allowed === false) {
    await logSecurityEvent(supabase, { event_type: "rate_limit_exceeded", ip_address: ip, user_agent: ua, endpoint: "submit-booking", severity: "warn", metadata: { retry_after: rl.retry_after_seconds } });
    return new Response(JSON.stringify({ error: "Troppe richieste, riprova più tardi." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retry_after_seconds || 3600) } });
  }

  try {
    const raw = await req.json();
    const parsed = BookingSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const data = parsed.data;

    // Honeypot triggered → silent reject (200 to mislead bots)
    if (data.website && data.website.length > 0) {
      console.warn("[submit-booking] honeypot triggered for", data.email);
      await logSecurityEvent(supabase, { event_type: "honeypot_triggered", identifier: data.email, ip_address: ip, user_agent: ua, endpoint: "submit-booking", severity: "warn" });
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Time-trap: form compilato in meno di 2s = bot
    if (data.formOpenedAt && (Date.now() - data.formOpenedAt) < 2000) {
      console.warn("[submit-booking] time-trap triggered for", data.email);
      await logSecurityEvent(supabase, { event_type: "time_trap_triggered", identifier: data.email, ip_address: ip, user_agent: ua, endpoint: "submit-booking", severity: "warn" });
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Blocked email check
    const { data: blocked } = await supabase.rpc("is_email_blocked", { _email: data.email });
    if (blocked === true) {
      console.warn("[submit-booking] blocked email", data.email);
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Duplicate check (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("trial_bookings")
      .select("id")
      .eq("email", data.email)
      .gte("created_at", oneHourAgo);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Hai già inviato una richiesta di recente. Ti contatteremo presto!" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: dbError } = await supabase.from("trial_bookings").insert({
      parent_name: data.parentName.trim(),
      email: data.email,
      phone: data.phone.trim(),
      child_age: data.childAge ?? 0,
      interest: data.interest || "non-so",
      availability: data.availability || null,
      message: data.message?.trim() || null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: "Errore nel salvataggio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send notification email server-to-server without blocking the user's confirmation UI.
    sendNotificationInBackground({
      parentName: data.parentName.trim(),
      email: data.email,
      phone: data.phone.trim(),
      childAge: data.childAge,
      interest: data.interest,
      availability: data.availability,
      message: data.message?.trim(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Prenotazione ricevuta con successo",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-booking:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

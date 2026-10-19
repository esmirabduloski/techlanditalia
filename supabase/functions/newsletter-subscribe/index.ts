import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { clientIp } from "../_shared/clientip.ts";
import { sendEmail } from "../_shared/email.ts";
import { newsletterConfirmEmail } from "../_shared/emailtemplates.ts";



const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  website: z.string().max(0).optional().or(z.literal("")),
  formOpenedAt: z.number().optional(),
});

const BOT_UA_PATTERNS = /(curl|wget|python-requests|scrapy|httpclient|go-http-client|java\/|libwww|httrack|nikto|sqlmap|nmap|masscan|zgrab|acunetix|nessus|burpsuite)/i;

async function logSecurityEvent(supabase: any, event: Record<string, unknown>) {
  try { await supabase.from("security_events").insert(event); } catch (e) { console.error("[sec-log]", e); }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  if (!ua || BOT_UA_PATTERNS.test(ua)) {
    await logSecurityEvent(supabase, { event_type: "bot_ua_blocked", ip_address: ip, user_agent: ua, endpoint: "newsletter-subscribe", severity: "warn" });
    return new Response(JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  // Rate limit: max 5 per day per IP
  const { data: rl } = await supabase.rpc("check_rate_limit", {
    _identifier: ip, _endpoint: "newsletter-subscribe", _max_requests: 5, _window_seconds: 86400,
  });
  if (rl && rl.allowed === false) {
    await logSecurityEvent(supabase, { event_type: "rate_limit_exceeded", ip_address: ip, user_agent: ua, endpoint: "newsletter-subscribe", severity: "warn" });
    return new Response(JSON.stringify({ error: "Troppe richieste, riprova più tardi." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders, "Retry-After": String(rl.retry_after_seconds || 86400) } });
  }

  try {
    const raw = await req.json();
    const parsed = SubscribeSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Email non valida", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { email, website, formOpenedAt } = parsed.data;

    if (website && website.length > 0) {
      await logSecurityEvent(supabase, { event_type: "honeypot_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "newsletter-subscribe", severity: "warn" });
      return new Response(JSON.stringify({ message: "Controlla la tua email per confermare l'iscrizione!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (formOpenedAt && (Date.now() - formOpenedAt) < 2000) {
      await logSecurityEvent(supabase, { event_type: "time_trap_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "newsletter-subscribe", severity: "warn" });
      return new Response(JSON.stringify({ message: "Controlla la tua email per confermare l'iscrizione!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: blocked } = await supabase.rpc("is_email_blocked", { _email: email });
    if (blocked === true) {
      return new Response(JSON.stringify({ message: "Controlla la tua email per confermare l'iscrizione!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, confirmed, confirmation_token")
      .eq("email", email)
      .maybeSingle();

    let confirmationToken: string;

    if (existing) {
      if (existing.confirmed) {
        return new Response(JSON.stringify({ message: "Sei già iscritto alla newsletter!" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      confirmationToken = existing.confirmation_token;
    } else {
      const { data: newSubscriber, error: insertError } = await supabase
        .from("newsletter_subscribers")
        .insert({ email })
        .select("confirmation_token")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Errore durante l'iscrizione. Riprova più tardi." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      confirmationToken = newSubscriber.confirmation_token;
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://techlanditalia.it";
    const confirmUrl = `${supabaseUrl}/functions/v1/newsletter-confirm?token=${confirmationToken}`;

    const sent = await sendEmail({
      kind: "newsletter_confirm",
      source: "newsletter-subscribe",
      from: "TECHLAND <noreply@techlanditalia.it>",
      to: email,
      ...newsletterConfirmEmail({ confirmUrl, siteUrl, year: new Date().getFullYear() }),
    });
    const emailError = sent.ok ? null : sent.error;

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(JSON.stringify({ error: "Errore nell'invio dell'email di conferma." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true, message: "Controlla la tua email per confermare l'iscrizione!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Newsletter subscribe error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);

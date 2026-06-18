import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://esm.sh/zod@3.23.8";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  website: z.string().max(0).optional().or(z.literal("")),
  formOpenedAt: z.number().optional(),
});

const BOT_UA_PATTERNS = /(curl|wget|python-requests|scrapy|httpclient|go-http-client|java\/|libwww|httrack|nikto|sqlmap|nmap|masscan|zgrab|acunetix|nessus|burpsuite)/i;

function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

async function logSecurityEvent(supabase: any, event: Record<string, unknown>) {
  try { await supabase.from("security_events").insert(event); } catch (e) { console.error("[sec-log]", e); }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const ip = getClientIp(req);
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

    const { error: emailError } = await resend.emails.send({
      from: "TECHLAND <noreply@techlanditalia.it>",
      to: [email],
      subject: "Conferma la tua iscrizione alla newsletter TECHLAND",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #10b981; margin: 0;">🚀 TECHLAND</h1><p style="color: #666; margin-top: 5px;">Coding per Ragazzi</p></div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Conferma la tua iscrizione</h2>
            <p>Ciao! 👋</p>
            <p>Grazie per aver richiesto di iscriverti alla newsletter di TECHLAND. Per completare l'iscrizione, clicca sul pulsante qui sotto:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">✅ Conferma Iscrizione</a>
            </div>
            <p style="color: #666; font-size: 14px;">Se non hai richiesto questa iscrizione, puoi ignorare questa email.</p>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} TECHLAND - Tutti i diritti riservati</p>
            <p><a href="${siteUrl}" style="color: #10b981;">techlanditalia.it</a></p>
          </div>
        </body></html>`,
    });

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

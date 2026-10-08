import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { clientIp } from "../_shared/clientip.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


function escapeHtml(text: string): string {
  const ent: Record<string, string> = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };
  return text.replace(/[&<>"']/g, (c) => ent[c] || c);
}

const ContactSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  oggetto: z.string().trim().min(1).max(200),
  messaggio: z.string().trim().min(1).max(5000),
  // Honeypot
  website: z.string().max(0).optional().or(z.literal("")),
  formOpenedAt: z.number().optional(),
});

async function sendEmail(to: string[], subject: string, html: string, replyTo?: string, text?: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "TechLand Italia <info@techlanditalia.it>",
      to, subject, html,
      ...(text ? { text } : {}),
      reply_to: replyTo,
    }),
  });
  if (!response.ok) throw new Error(`Failed to send email: ${await response.text()}`);
  return response.json();
}

const BOT_UA_PATTERNS = /(curl|wget|python-requests|scrapy|httpclient|go-http-client|java\/|libwww|httrack|nikto|sqlmap|nmap|masscan|zgrab|acunetix|nessus|burpsuite)/i;

async function logSecurityEvent(supabase: any, event: Record<string, unknown>) {
  try { await supabase.from("security_events").insert(event); } catch (e) { console.error("[sec-log]", e); }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  if (!ua || BOT_UA_PATTERNS.test(ua)) {
    await logSecurityEvent(supabase, { event_type: "bot_ua_blocked", ip_address: ip, user_agent: ua, endpoint: "send-contact-email", severity: "warn" });
    return new Response(JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const { data: rl } = await supabase.rpc("check_rate_limit", {
    _identifier: ip, _endpoint: "send-contact-email", _max_requests: 5, _window_seconds: 3600,
  });
  if (rl && rl.allowed === false) {
    await logSecurityEvent(supabase, { event_type: "rate_limit_exceeded", ip_address: ip, user_agent: ua, endpoint: "send-contact-email", severity: "warn", metadata: { retry_after: rl.retry_after_seconds } });
    return new Response(JSON.stringify({ error: "Troppe richieste, riprova più tardi." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders, "Retry-After": String(rl.retry_after_seconds || 3600) } });
  }

  try {
    const raw = await req.json();
    const parsed = ContactSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { nome, email, oggetto, messaggio, website, formOpenedAt } = parsed.data;

    // Honeypot
    if (website && website.length > 0) {
      console.warn("[contact] honeypot triggered for", email);
      await logSecurityEvent(supabase, { event_type: "honeypot_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "send-contact-email", severity: "warn" });
      return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Time-trap
    if (formOpenedAt && (Date.now() - formOpenedAt) < 2000) {
      console.warn("[contact] time-trap triggered for", email);
      await logSecurityEvent(supabase, { event_type: "time_trap_triggered", identifier: email, ip_address: ip, user_agent: ua, endpoint: "send-contact-email", severity: "warn" });
      return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Blocked email check
    const { data: blocked } = await supabase.rpc("is_email_blocked", { _email: email });
    if (blocked === true) {
      console.warn("[contact] blocked email", email);
      return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const safeNome = escapeHtml(nome);
    const safeEmail = escapeHtml(email);
    const safeOggetto = escapeHtml(oggetto);
    const safeMessaggio = escapeHtml(messaggio);

    let emailSent = false;
    let errorMessage: string | null = null;

    try {
      await sendEmail(
        ["info@techlanditalia.it"],
        `[Contatto] ${oggetto.substring(0, 100)}`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">Nuovo messaggio dal form contatti</h2>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nome:</strong> ${safeNome}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Oggetto:</strong> ${safeOggetto}</p>
          </div>
          <h3>Messaggio:</h3>
          <div style="background: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <p style="white-space: pre-wrap;">${safeMessaggio}</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
          <p style="color: #71717a; font-size: 12px;">Puoi rispondere direttamente a questa email per contattare ${safeNome}.</p>
        </div>`,
        email,
        `Nuovo messaggio\n\nNome: ${nome}\nEmail: ${email}\nOggetto: ${oggetto}\n\nMessaggio:\n${messaggio}`
      );

      // Nessuna email automatica all'indirizzo inserito dal visitatore:
      // eviterebbe che il form venga usato per inviare messaggi a terzi.

      emailSent = true;
    } catch (emailError: any) {
      console.error("Email sending failed:", emailError);
      errorMessage = emailError.message;
    }

    await supabase.from('contact_submissions').insert({
      nome, email, oggetto, messaggio,
      email_sent: emailSent,
      error_message: errorMessage,
    });

    await notifyAdmins({
      title: "Nuovo messaggio dal form contatti",
      body: `${nome} (${email}) · ${oggetto}`,
      path: "/admin/contatti",
      type: "new_contact_form",
    });

    if (!emailSent) {
      return new Response(JSON.stringify({ error: errorMessage || "Errore nell'invio email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-contact-email:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);

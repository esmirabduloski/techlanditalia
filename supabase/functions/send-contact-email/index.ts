import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
      return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Time-trap
    if (formOpenedAt && (Date.now() - formOpenedAt) < 2000) {
      console.warn("[contact] time-trap triggered for", email);
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

      await sendEmail(
        [email],
        "Abbiamo ricevuto il tuo messaggio!",
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">Grazie per averci contattato, ${safeNome}!</h2>
          <p>Abbiamo ricevuto il tuo messaggio e ti risponderemo il prima possibile.</p>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Oggetto:</strong> ${safeOggetto}</p>
            <p><strong>Messaggio:</strong></p>
            <p style="white-space: pre-wrap;">${safeMessaggio}</p>
          </div>
          <p>Nel frattempo, puoi anche contattarci su <a href="https://wa.me/message/KHFBHZDEY3S7H1" style="color: #0ea5e9;">WhatsApp</a>.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
          <p style="color: #71717a; font-size: 12px;">TechLand Italia - Corsi di programmazione per ragazzi e ragazze</p>
        </div>`,
        undefined,
        `Grazie ${nome}!\n\nMessaggio ricevuto.\n\nOggetto: ${oggetto}\nMessaggio:\n${messaggio}`
      );

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

    if (!emailSent) {
      return new Response(JSON.stringify({ error: errorMessage || "Errore nell'invio email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true, message: "Email inviate con successo" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-contact-email:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);

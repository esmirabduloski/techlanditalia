import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  nome: string;
  email: string;
  oggetto: string;
  messaggio: string;
}

async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  replyTo?: string,
  text?: string
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "TechLand Italia <info@techlanditalia.it>",
      to,
      subject,
      html,
      // Plain-text fallback improves deliverability (some inboxes penalize HTML-only emails)
      ...(text ? { text } : {}),
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role for database access
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { nome, email, oggetto, messaggio }: ContactEmailRequest = await req.json();

    // Validate required fields
    if (!nome || !email || !oggetto || !messaggio) {
      console.error("Missing required fields:", { nome: !!nome, email: !!email, oggetto: !!oggetto, messaggio: !!messaggio });
      return new Response(
        JSON.stringify({ error: "Tutti i campi sono obbligatori" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Formato email non valido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending contact email from:", email, "Subject:", oggetto);

    let emailSent = false;
    let errorMessage: string | null = null;

    try {
      // Send notification to admin
      const adminEmailResponse = await sendEmail(
        ["info@techlanditalia.it"],
        `[Contatto] ${oggetto}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">Nuovo messaggio dal form contatti</h2>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Nome:</strong> ${nome}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Oggetto:</strong> ${oggetto}</p>
            </div>
            <h3>Messaggio:</h3>
            <div style="background: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
              <p style="white-space: pre-wrap;">${messaggio}</p>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
            <p style="color: #71717a; font-size: 12px;">
              Puoi rispondere direttamente a questa email per contattare ${nome}.
            </p>
          </div>
        `,
        email,
        `Nuovo messaggio dal form contatti\n\nNome: ${nome}\nEmail: ${email}\nOggetto: ${oggetto}\n\nMessaggio:\n${messaggio}`
      );

      console.log("Admin email sent:", adminEmailResponse);

      // Send confirmation to user
      const userEmailResponse = await sendEmail(
        [email],
        "Abbiamo ricevuto il tuo messaggio!",
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">Grazie per averci contattato, ${nome}!</h2>
            <p>Abbiamo ricevuto il tuo messaggio e ti risponderemo il prima possibile.</p>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Oggetto:</strong> ${oggetto}</p>
              <p><strong>Messaggio:</strong></p>
              <p style="white-space: pre-wrap;">${messaggio}</p>
            </div>
            <p>Nel frattempo, puoi anche contattarci su <a href="https://wa.me/393512508851" style="color: #0ea5e9;">WhatsApp</a> per una risposta più rapida.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">
            <p style="color: #71717a; font-size: 12px;">
              TechLand Italia - Corsi di programmazione per bambini e ragazzi
            </p>
          </div>
        `,
        undefined,
        `Grazie per averci contattato, ${nome}!\n\nAbbiamo ricevuto il tuo messaggio e ti risponderemo il prima possibile.\n\nOggetto: ${oggetto}\n\nMessaggio:\n${messaggio}\n\nWhatsApp: https://wa.me/393512508851` 
      );

      console.log("User confirmation email sent:", userEmailResponse);
      emailSent = true;
    } catch (emailError: any) {
      console.error("Email sending failed:", emailError);
      errorMessage = emailError.message;
    }

    // Save submission to database for audit
    const { error: dbError } = await supabase
      .from('contact_submissions')
      .insert({
        nome,
        email,
        oggetto,
        messaggio,
        email_sent: emailSent,
        error_message: errorMessage,
      });

    if (dbError) {
      console.error("Failed to save submission to database:", dbError);
    }

    if (!emailSent) {
      return new Response(
        JSON.stringify({ error: errorMessage || "Errore nell'invio email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email inviate con successo"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

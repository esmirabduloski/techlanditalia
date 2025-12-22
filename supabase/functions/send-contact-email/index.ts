import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

async function sendEmail(to: string[], subject: string, html: string, replyTo?: string) {
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
      email
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
      `
    );

    console.log("User confirmation email sent:", userEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email inviate con successo",
        adminEmail: adminEmailResponse,
        userEmail: userEmailResponse
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

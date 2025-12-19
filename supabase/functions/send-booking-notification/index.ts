import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  parentName: string;
  email: string;
  phone?: string;
  childAge: number;
  interest: string;
  availability?: string;
  message?: string;
  adminEmail: string;
}

const interestLabels: Record<string, string> = {
  "coding-base": "Coding Base (6-8 anni)",
  "game-dev": "Game Development",
  "roblox": "Roblox Studio",
  "web": "Web Development",
  "python-ai": "Python & AI",
  "non-so": "Non sono sicuro, vorrei consigli",
};

const availabilityLabels: Record<string, string> = {
  "mattina": "Mattina (9-12)",
  "pomeriggio": "Pomeriggio (14-18)",
  "sera": "Sera (18-20)",
  "weekend": "Weekend",
  "qualsiasi": "Qualsiasi orario",
};

async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TECHLAND <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: BookingNotificationRequest = await req.json();
    console.log("Received booking notification request:", data);

    const interestLabel = interestLabels[data.interest] || data.interest;
    const availabilityLabel = data.availability 
      ? availabilityLabels[data.availability] || data.availability 
      : "Non specificata";

    // Email to admin
    const adminEmailResult = await sendEmail(
      [data.adminEmail],
      `🎯 Nuova prenotazione lezione di prova - ${data.parentName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Nuova Prenotazione Lezione di Prova</h1>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Contatto</h2>
            <p><strong>Nome genitore:</strong> ${data.parentName}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Telefono:</strong> ${data.phone || "Non fornito"}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Bambino</h2>
            <p><strong>Età:</strong> ${data.childAge} anni</p>
            <p><strong>Interesse:</strong> ${interestLabel}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Preferenze</h2>
            <p><strong>Disponibilità:</strong> ${availabilityLabel}</p>
            ${data.message ? `<p><strong>Messaggio:</strong> ${data.message}</p>` : ""}
          </div>
          <p style="color: #666; font-size: 14px;">Ricordati di contattare il genitore entro 24 ore!</p>
        </div>
      `
    );

    console.log("Admin email sent:", adminEmailResult);

    // Confirmation email to parent
    const parentEmailResult = await sendEmail(
      [data.email],
      "✅ Abbiamo ricevuto la tua richiesta - TECHLAND",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Ciao ${data.parentName}!</h1>
          <p>Grazie per aver scelto <strong>TECHLAND</strong> per il tuo bambino.</p>
          <p>Abbiamo ricevuto la tua richiesta per una <strong>lezione di prova gratuita</strong> e ti contatteremo entro 24 ore per confermare l'appuntamento.</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Riepilogo della tua richiesta</h2>
            <p><strong>Età del bambino:</strong> ${data.childAge} anni</p>
            <p><strong>Area di interesse:</strong> ${interestLabel}</p>
            <p><strong>Disponibilità preferita:</strong> ${availabilityLabel}</p>
          </div>
          
          <h3>Cosa succede ora?</h3>
          <ol>
            <li>Un nostro consulente ti contatterà per fissare l'appuntamento</li>
            <li>Riceverai un link per la lezione di prova online</li>
            <li>Il tuo bambino potrà provare il corso scelto con un nostro docente</li>
          </ol>
          
          <p>Se hai domande nel frattempo, puoi rispondere a questa email.</p>
          
          <p style="margin-top: 30px;">A presto,<br><strong>Il team TECHLAND</strong></p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            TECHLAND - La scuola di tecnologia per bambini e ragazzi
          </p>
        </div>
      `
    );

    console.log("Parent confirmation email sent:", parentEmailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        adminEmail: adminEmailResult, 
        parentEmail: parentEmailResult 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

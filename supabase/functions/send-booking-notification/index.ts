import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

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
      from: "TechLand Italia <info@techlanditalia.it>",
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
    // Internal-only: require shared secret (service role key) so only server-to-server calls work
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!internalSecret || !expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data: BookingNotificationRequest = await req.json();
    console.log("Received booking notification request for:", data.email);

    // Sanitize user inputs for safe HTML embedding
    const safeParentName = escapeHtml(data.parentName || '');
    const safeEmail = escapeHtml(data.email || '');
    const safePhone = escapeHtml(data.phone || '');
    const safeMessage = data.message ? escapeHtml(data.message) : '';

    const interestLabel = interestLabels[data.interest] || escapeHtml(data.interest || '');
    const availabilityLabel = data.availability 
      ? availabilityLabels[data.availability] || escapeHtml(data.availability) 
      : "Non specificata";

    // Force admin recipient server-side; ignore any client-supplied address
    const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "info@techlanditalia.it";

    // Email to admin (using sanitized values)
    const adminEmailResult = await sendEmail(
      [ADMIN_EMAIL],
      `🎯 Nuova prenotazione lezione di prova - ${data.parentName?.substring(0, 50) || 'Nuovo'}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Nuova Prenotazione Lezione di Prova</h1>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Contatto</h2>
            <p><strong>Nome genitore:</strong> ${safeParentName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Telefono:</strong> ${safePhone || "Non fornito"}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Dettagli Bambino</h2>
            <p><strong>Età:</strong> ${data.childAge} anni</p>
            <p><strong>Interesse:</strong> ${interestLabel}</p>
          </div>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Preferenze</h2>
            <p><strong>Disponibilità:</strong> ${availabilityLabel}</p>
            ${safeMessage ? `<p><strong>Messaggio:</strong> ${safeMessage}</p>` : ""}
          </div>
          <p style="color: #666; font-size: 14px;">Ricordati di contattare il genitore entro 24 ore!</p>
        </div>
      `
    );

    console.log("Admin email sent:", adminEmailResult);

    // Confirmation email to parent (using sanitized values)
    const parentEmailResult = await sendEmail(
      [data.email],
      "✅ Abbiamo ricevuto la tua richiesta - TECHLAND",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Ciao ${safeParentName}!</h1>
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
      JSON.stringify({ error: "Errore interno" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

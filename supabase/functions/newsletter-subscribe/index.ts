import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscribeRequest {
  email: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: SubscribeRequest = await req.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email è obbligatoria" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!emailRegex.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Formato email non valido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (trimmedEmail.length > 255) {
      return new Response(
        JSON.stringify({ error: "Email troppo lunga" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email already exists
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, confirmed, confirmation_token")
      .eq("email", trimmedEmail)
      .maybeSingle();

    let confirmationToken: string;

    if (existing) {
      if (existing.confirmed) {
        return new Response(
          JSON.stringify({ message: "Sei già iscritto alla newsletter!" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Resend confirmation email with existing token
      confirmationToken = existing.confirmation_token;
      console.log(`Resending confirmation to existing subscriber: ${trimmedEmail}`);
    } else {
      // Insert new subscriber
      const { data: newSubscriber, error: insertError } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: trimmedEmail })
        .select("confirmation_token")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Errore durante l'iscrizione. Riprova più tardi." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      confirmationToken = newSubscriber.confirmation_token;
      console.log(`New subscriber created: ${trimmedEmail}`);
    }

    // Build confirmation URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://techlanditalia.it";
    const confirmUrl = `${supabaseUrl}/functions/v1/newsletter-confirm?token=${confirmationToken}`;

    // Send confirmation email
    const { error: emailError } = await resend.emails.send({
      from: "TECHLAND <noreply@techlanditalia.it>",
      to: [trimmedEmail],
      subject: "Conferma la tua iscrizione alla newsletter TECHLAND",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; margin: 0;">🚀 TECHLAND</h1>
            <p style="color: #666; margin-top: 5px;">Coding per Bambini</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Conferma la tua iscrizione</h2>
            <p>Ciao! 👋</p>
            <p>Grazie per aver richiesto di iscriverti alla newsletter di TECHLAND. Per completare l'iscrizione, clicca sul pulsante qui sotto:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                ✅ Conferma Iscrizione
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Se non hai richiesto questa iscrizione, puoi semplicemente ignorare questa email.</p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} TECHLAND - Tutti i diritti riservati</p>
            <p>
              <a href="${siteUrl}" style="color: #10b981;">techlanditalia.it</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(
        JSON.stringify({ error: "Errore nell'invio dell'email di conferma. Riprova più tardi." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Confirmation email sent to: ${trimmedEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Controlla la tua email per confermare l'iscrizione!" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Newsletter subscribe error:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

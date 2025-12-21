import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getPasswordResetEmailTemplate = (resetLink: string) => `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔐 Reset Password</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 22px;">Ciao! 👋</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Abbiamo ricevuto una richiesta per reimpostare la password del tuo account TECHLAND.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Clicca il pulsante qui sotto per creare una nuova password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Reimposta Password →
                </a>
              </div>
              
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                  ⚠️ <strong>Attenzione:</strong> Se non hai richiesto tu il reset della password, puoi ignorare questa email. Il tuo account rimarrà sicuro.
                </p>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0;">
                Il link scadrà tra 1 ora per motivi di sicurezza.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 14px; margin: 0 0 10px;">
                Il Team TECHLAND 💚
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Corsi di coding per giovani esploratori digitali
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Extract data from Supabase auth hook payload
    const { user, email_data } = payload;
    const userEmail = user?.email;
    const { token_hash, redirect_to, email_action_type } = email_data || {};
    
    if (!userEmail || !token_hash) {
      console.error("Missing required fields:", { userEmail, token_hash });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending password reset email to ${userEmail}`);

    // Build the reset link
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const resetLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    const htmlContent = getPasswordResetEmailTemplate(resetLink);

    const emailResponse = await resend.emails.send({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [userEmail],
      subject: "🔐 Reimposta la tua password - TECHLAND",
      html: htmlContent,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

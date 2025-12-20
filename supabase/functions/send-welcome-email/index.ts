import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  role: "student" | "parent";
}

const getStudentEmailTemplate = (fullName: string) => `
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
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🚀 Benvenuto in TECHLAND!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 22px;">Ciao ${fullName}! 👋</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Siamo super felici di averti con noi! La tua avventura nel mondo del coding sta per iniziare! 🎮
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Preparati a creare videogiochi, app e progetti incredibili insieme ai nostri tutor!
              </p>
              
              <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #10b981; margin: 0 0 15px; font-size: 18px;">🎯 Cosa puoi fare ora:</h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Accedi alla tua Area Riservata</li>
                  <li>Esplora i corsi disponibili</li>
                  <li>Inizia a guadagnare punti e badge!</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://techlanditalia.it/area-riservata" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Vai all'Area Riservata →
                </a>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                Ci vediamo online! 🖥️
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

const getParentEmailTemplate = (fullName: string) => `
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
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Benvenuto in TECHLAND</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 22px;">Gentile ${fullName},</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                La ringraziamo per aver scelto TECHLAND per l'educazione tecnologica del suo bambino.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Il suo account è stato creato con successo. Dalla sua Area Riservata potrà:
              </p>
              
              <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Monitorare i progressi di suo figlio/a</li>
                  <li>Visualizzare i compiti e i feedback degli insegnanti</li>
                  <li>Comunicare direttamente con il team TECHLAND</li>
                  <li>Consultare i materiali dei corsi</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://techlanditalia.it/area-riservata" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Accedi all'Area Riservata →
                </a>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">
                Per qualsiasi domanda, non esiti a contattarci rispondendo a questa email.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                Cordiali saluti,
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px; font-weight: 600;">
                Il Team TECHLAND
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Corsi di coding per bambini e ragazzi | techlanditalia.it
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
    const { email, fullName, role }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to ${email} (${role})`);

    const isStudent = role === "student";
    const htmlContent = isStudent 
      ? getStudentEmailTemplate(fullName)
      : getParentEmailTemplate(fullName);

    const subject = isStudent
      ? "🚀 Benvenuto in TECHLAND! La tua avventura inizia ora"
      : "Benvenuto in TECHLAND - Account creato con successo";

    const emailResponse = await resend.emails.send({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

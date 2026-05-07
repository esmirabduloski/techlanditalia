import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  role: "student" | "parent";
  childName?: string;
  childUsername?: string;
  password?: string;
}

const getParentEmailTemplate = (
  fullName: string,
  childName: string,
  childUsername: string,
  email: string,
  password: string,
) => `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;">
    <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:40px 30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Benvenuto in TECHLAND</h1></td></tr>
      <tr><td style="padding:40px 30px;">
        <h2 style="color:#1f2937;margin:0 0 20px;font-size:22px;">Gentile ${fullName},</h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px;">La ringraziamo per aver scelto TECHLAND per l'educazione tecnologica di ${childName}.</p>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px;">Il suo account e quello di ${childName} sono stati creati con successo.</p>
        <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border-radius:12px;padding:24px;margin:30px 0;border:2px solid #3b82f6;">
          <h3 style="color:#1d4ed8;margin:0 0 15px;font-size:18px;">🔑 Le sue credenziali di accesso (genitore):</h3>
          <p style="color:#1f2937;font-size:16px;font-weight:bold;margin:8px 0;"><strong>Email:</strong> ${email}</p>
          <p style="color:#1f2937;font-size:16px;font-weight:bold;margin:8px 0;"><strong>Password:</strong> ${password}</p>
          <p style="color:#6b7280;font-size:13px;margin:12px 0 0;font-style:italic;">Le consigliamo di conservare queste credenziali in un luogo sicuro</p>
        </div>
        <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfeff 100%);border-radius:12px;padding:24px;margin:30px 0;border:2px solid #10b981;">
          <h3 style="color:#059669;margin:0 0 15px;font-size:18px;">🔐 Accesso di ${childName}:</h3>
          <p style="color:#1f2937;font-size:16px;font-weight:bold;margin:8px 0;"><strong>Nome utente:</strong> ${childUsername}</p>
          <p style="color:#4b5563;font-size:15px;margin:8px 0;"><strong>Password:</strong> la stessa del genitore</p>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://techlanditalia.it/area-riservata" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">Accedi all'Area Riservata →</a>
        </div>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0;">Cordiali saluti,</p>
      </td></tr>
      <tr><td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280;font-size:14px;margin:0 0 10px;font-weight:600;">Il Team TECHLAND</p>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Corsi di coding per bambini e ragazzi | techlanditalia.it</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: caller must be an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, fullName, role, childName, childUsername, password }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to ${email} (${role})`);

    const safeFullName = escapeHtml(fullName || "");
    const safeChildName = escapeHtml(childName || "");
    const safeChildUsername = escapeHtml(childUsername || "");
    const safeEmail = escapeHtml(email || "");
    const safePassword = escapeHtml(password || "");

    const htmlContent = getParentEmailTemplate(safeFullName, safeChildName, safeChildUsername, safeEmail, safePassword);
    const subject = "Benvenuto in TECHLAND - Account creato con successo";

    const emailResponse = await resend.emails.send({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [email],
      bcc: ["techlanditalia.it+af31baed12@invite.trustpilot.com"],
      subject: subject,
      html: htmlContent,
    });

    console.log("Welcome email sent successfully");

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(JSON.stringify({ success: false, error: "Errore interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

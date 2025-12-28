import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

const getPasswordChangeEmailTemplate = (parentName: string, childName: string, newPassword: string) => `
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
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔐 Password Aggiornata</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 22px;">Gentile ${parentName},</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Le comunichiamo che la password di accesso di <strong>${childName}</strong> è stata aggiornata.
              </p>
              
              <!-- New Password Box -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%); border-radius: 12px; padding: 24px; margin: 30px 0; border: 2px solid #f59e0b;">
                <h3 style="color: #b45309; margin: 0 0 15px; font-size: 18px;">🔑 Nuova password:</h3>
                <p style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0; text-align: center; letter-spacing: 2px;">
                  ${newPassword}
                </p>
                <p style="color: #6b7280; font-size: 13px; margin: 15px 0 0; font-style: italic; text-align: center;">
                  Conservi questa password in un luogo sicuro.
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                ${childName} potrà utilizzare questa nuova password per accedere alla sua area personale.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://techlanditalia.it/area-riservata" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Accedi all'Area Riservata →
                </a>
              </div>
              
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Solo gli admin possono modificare le password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "La password deve essere di almeno 6 caratteri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get student profile to find parent
    const { data: studentProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, parent_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching student profile:", profileError);
    }

    // Update user password using admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error("Error updating password:", error);
      
      // Handle specific error types
      if (error.message?.includes("weak") || error.code === "weak_password") {
        return new Response(JSON.stringify({ 
          error: "La password è troppo debole. Scegli una password più complessa con lettere, numeri e simboli." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Impossibile aggiornare la password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Password updated for user ${userId} by admin ${user.id}`);

    // Send email to parent if available
    if (studentProfile?.parent_id) {
      try {
        // Get parent email from auth.users
        const { data: parentAuth, error: parentAuthError } = await supabaseAdmin.auth.admin.getUserById(studentProfile.parent_id);
        
        // Get parent profile for name
        const { data: parentProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", studentProfile.parent_id)
          .single();

        if (parentAuth?.user?.email && !parentAuthError) {
          const parentEmail = parentAuth.user.email;
          const parentName = parentProfile?.full_name || "Genitore";
          const childName = studentProfile.full_name || "Vostro figlio/a";

          console.log(`Sending password change notification to ${parentEmail}`);

          const htmlContent = getPasswordChangeEmailTemplate(
            escapeHtml(parentName),
            escapeHtml(childName),
            escapeHtml(newPassword)
          );

          const emailResponse = await resend.emails.send({
            from: "TECHLAND <info@techlanditalia.it>",
            to: [parentEmail],
            subject: `TECHLAND - Password aggiornata per ${childName}`,
            html: htmlContent,
          });

          console.log("Password change email sent:", emailResponse);
        }
      } catch (emailError) {
        // Log but don't fail if email sending fails
        console.error("Error sending password change email:", emailError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

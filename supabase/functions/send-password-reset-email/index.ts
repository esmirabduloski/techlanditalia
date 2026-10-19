import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { sendEmail } from "../_shared/email.ts";
import { passwordResetEmail } from "../_shared/emailtemplates.ts";



const ALLOWED_HOSTS = new Set([
  "techlanditalia.it",
  "www.techlanditalia.it",
  "techlanditalia.lovable.app",
]);

function isAllowedRedirect(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Il link porta il token di sessione: solo https e solo i nostri domini esatti.
    // Niente wildcard *.lovable.app, chiunque può pubblicarci un sito e rubare il token.
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  console.log("Password reset function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "send-password-reset-email", maxRequests: 5, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const { email, redirectUrl }: PasswordResetRequest = await req.json();
    
    console.log("Processing password reset for email:", email);
    console.log("Redirect URL:", redirectUrl);

    if (!email) {
      console.error("Missing email");
      return new Response(
        JSON.stringify({ error: "Email richiesta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Validate redirect URL against allowlist to prevent open-redirect phishing
    const safeRedirect = isAllowedRedirect(redirectUrl)
      ? redirectUrl
      : "https://techlanditalia.it/auth?reset=true";

    // Generate password reset link using Admin API
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: safeRedirect
      }
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "Se l'email esiste, riceverai un link per reimpostare la password" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.properties?.action_link) {
      console.error("No action link in response:", data);
      return new Response(
        JSON.stringify({ success: true, message: "Se l'email esiste, riceverai un link per reimpostare la password" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = data.properties.action_link;
    console.log("Generated reset link successfully");

    // Send custom email via Resend (registrata senza corpo: contiene il link di accesso)
    const emailResponse = await sendEmail({
      kind: "password_reset",
      source: "send-password-reset-email",
      to: email.trim().toLowerCase(),
      recipientId: data.user?.id ?? null,
      ...passwordResetEmail(resetLink),
    });
    console.log("Email sent:", emailResponse.ok ? emailResponse.id : emailResponse.error);

    return new Response(
      JSON.stringify({ success: true, message: "Email di reset inviata con successo" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in password reset function:", error);
    return new Response(
      JSON.stringify({ error: "Errore durante l'invio dell'email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

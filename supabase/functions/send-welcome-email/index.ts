import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { sendEmail } from "../_shared/email.ts";
import { TRUSTPILOT_AFS_ADDRESS, trustpilotInviteEmail, welcomeEmail } from "../_shared/emailtemplates.ts";

const FN = "send-welcome-email";

/**
 * Trustpilot legge i dati dell'invito dallo snippet JSON: riceve solo nome ed
 * email del genitore (più un riferimento), nient'altro.
 */
async function sendTrustpilotInvitation(email: string, fullName: string) {
  const mail = trustpilotInviteEmail({ email, fullName, referenceId: `account-${Date.now()}` });
  const result = await sendEmail({ kind: "trustpilot_invite", source: FN, to: TRUSTPILOT_AFS_ADDRESS, ...mail });
  if (!result.ok) throw new Error(result.error);
}

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  role: "student" | "parent" | "teacher";
  childName?: string;
  childUsername?: string;
  setupLink?: string;
  /** Profilo appena creato, per il registro email. */
  userId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "send-welcome-email", maxRequests: 20, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

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

    const { email, fullName, role, childName, childUsername, setupLink, userId }: WelcomeEmailRequest = await req.json();
    const recipientId = typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;

    console.log(`Sending welcome email (${role})`);

    const mail = welcomeEmail({
      fullName: fullName || "",
      email: email || "",
      childName: childName || "",
      childUsername: childUsername || "",
      setupLink: setupLink || "",
    });
    const emailResponse = await sendEmail({ kind: "welcome", source: FN, to: email, recipientId, ...mail });
    if (!emailResponse.ok) throw new Error(emailResponse.error);

    console.log("Welcome email sent successfully");

    // Invito a recensirci su Trustpilot, solo per i genitori. Messaggio separato con
    // il minimo indispensabile: prima l'intera email di benvenuto andava in BCC a
    // Trustpilot, compresi i dati del figlio e il link per impostare la password.
    if (role === "parent" && email) {
      await sendTrustpilotInvitation(email, fullName || "").catch((e) =>
        console.error("Trustpilot invitation failed:", e)
      );
    }

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

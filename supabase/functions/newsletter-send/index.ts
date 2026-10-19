import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { sendEmail } from "../_shared/email.ts";
import { newsletterEmail } from "../_shared/emailtemplates.ts";



interface SendNewsletterRequest {
  subject: string;
  content: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "newsletter-send", maxRequests: 5, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorizzato" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify the user is an admin
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorizzato" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is admin using service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Solo gli admin possono inviare newsletter" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { subject, content }: SendNewsletterRequest = await req.json();

    // Validate input
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Oggetto obbligatorio" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Contenuto obbligatorio" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all confirmed subscribers
    const { data: subscribers, error: fetchError } = await supabase
      .from("newsletter_subscribers")
      .select("email, unsubscribe_token")
      .eq("confirmed", true);

    if (fetchError) {
      await captureServerError(fetchError, { fn: "newsletter-send", tags: { step: "subscribers" } });
      return new Response(
        JSON.stringify({ error: "Errore nel recupero degli iscritti" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nessun iscritto confermato" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending newsletter to ${subscribers.length} subscribers`);

    const siteUrl = Deno.env.get("SITE_URL") || "https://techlanditalia.it";
    let sentCount = 0;
    const errors: string[] = [];

    // Send emails in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const promises = batch.map(async (subscriber) => {
        // Link nell'email: pagina del sito che chiede conferma prima di disiscrivere.
        const unsubscribeUrl = `${siteUrl}/newsletter?azione=disiscrizione&token=${subscriber.unsubscribe_token}`;
        // Header List-Unsubscribe: disiscrizione con un clic dal client email (RFC 8058),
        // richiesta da Gmail e Yahoo a chi invia newsletter.
        const oneClickUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${subscriber.unsubscribe_token}`;
        
        try {
          const sent = await sendEmail({
            kind: "newsletter",
            source: "newsletter-send",
            from: "TECHLAND <newsletter@techlanditalia.it>",
            to: subscriber.email,
            headers: {
              "List-Unsubscribe": `<${oneClickUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            ...newsletterEmail({ subject, contentHtml: content, siteUrl, unsubscribeUrl, year: new Date().getFullYear() }),
          });
          const emailError = sent.ok ? null : sent.error;

          if (emailError) {
            console.error(`Error sending to ${subscriber.email}:`, emailError);
            errors.push(subscriber.email);
          } else {
            sentCount++;
          }
        } catch (err) {
          console.error(`Exception sending to ${subscriber.email}:`, err);
          errors.push(subscriber.email);
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Newsletter sent: ${sentCount}/${subscribers.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        totalSubscribers: subscribers.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    await captureServerError(error, { fn: "newsletter-send" });
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

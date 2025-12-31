import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNewsletterRequest {
  subject: string;
  content: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      console.error("Fetch subscribers error:", fetchError);
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
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${subscriber.unsubscribe_token}`;
        
        try {
          const { error: emailError } = await resend.emails.send({
            from: "TECHLAND <newsletter@techlanditalia.it>",
            to: [subscriber.email],
            subject: subject.trim(),
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
                  ${content}
                </div>
                
                <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                  <p>© ${new Date().getFullYear()} TECHLAND - Tutti i diritti riservati</p>
                  <p>
                    <a href="${siteUrl}" style="color: #10b981;">techlanditalia.it</a>
                  </p>
                  <p style="margin-top: 20px;">
                    <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Disiscriviti dalla newsletter</a>
                  </p>
                </div>
              </body>
              </html>
            `,
          });

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
    console.error("Newsletter send error:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

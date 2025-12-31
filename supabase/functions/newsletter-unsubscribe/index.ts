import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const siteUrl = Deno.env.get("SITE_URL") || "https://techlanditalia.it";

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return createHtmlResponse(siteUrl, false, "Token mancante");
    }

    // Validate token format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return createHtmlResponse(siteUrl, false, "Token non valido");
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and delete subscriber by unsubscribe token
    const { data: subscriber, error: fetchError } = await supabase
      .from("newsletter_subscribers")
      .select("id, email")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (fetchError || !subscriber) {
      console.error("Subscriber not found:", fetchError);
      return createHtmlResponse(siteUrl, false, "Link non valido o già utilizzato");
    }

    // Delete subscriber
    const { error: deleteError } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("id", subscriber.id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return createHtmlResponse(siteUrl, false, "Errore durante la disiscrizione. Riprova più tardi.");
    }

    console.log(`Newsletter unsubscribed: ${subscriber.email}`);
    return createHtmlResponse(siteUrl, true, "Ti sei disiscritto dalla newsletter");

  } catch (error: any) {
    console.error("Newsletter unsubscribe error:", error);
    return createHtmlResponse(siteUrl, false, "Errore interno del server");
  }
};

function createHtmlResponse(siteUrl: string, success: boolean, message: string): Response {
  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${success ? "Disiscrizione Completata" : "Errore"} - TECHLAND</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdfa 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 480px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: ${success ? "#10b981" : "#ef4444"};
          margin-bottom: 16px;
          font-size: 24px;
        }
        p {
          color: #666;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          background: #10b981;
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 600;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #059669;
        }
        .logo {
          color: #10b981;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 30px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚀 TECHLAND</div>
        <div class="icon">${success ? "👋" : "❌"}</div>
        <h1>${success ? "Ci mancherai!" : "Ops!"}</h1>
        <p>${message}</p>
        ${success ? `<p>Se cambi idea, puoi sempre reiscriverti dalla pagina del blog.</p>` : ""}
        <a href="${siteUrl}/blog" class="btn">Vai al Blog</a>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  });
}

serve(handler);

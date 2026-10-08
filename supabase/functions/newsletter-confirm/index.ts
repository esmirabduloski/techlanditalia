/**
 * Conferma dell'iscrizione alla newsletter (double opt-in) dal link nell'email.
 *
 * Esegue la conferma e rimanda alla pagina /newsletter del sito con l'esito:
 * le edge function non possono mostrare pagine HTML (Supabase le serve come
 * testo semplice, quindi prima si vedeva il codice sorgente).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Esito = "confermata" | "gia-confermata" | "link-non-valido" | "errore";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const siteUrl = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
  const redirect = (esito: Esito) =>
    new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${siteUrl}/newsletter?esito=${esito}` },
    });

  try {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!UUID_RE.test(token)) return redirect("link-non-valido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subscriber, error: fetchError } = await supabase
      .from("newsletter_subscribers")
      .select("id, confirmed")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return redirect("errore");
    }
    if (!subscriber) return redirect("link-non-valido");
    if (subscriber.confirmed) return redirect("gia-confermata");

    const { error: updateError } = await supabase
      .from("newsletter_subscribers")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("id", subscriber.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return redirect("errore");
    }

    console.log("Newsletter subscription confirmed:", subscriber.id);
    return redirect("confermata");
  } catch (error) {
    console.error("Newsletter confirm error:", error);
    return redirect("errore");
  }
};

serve(handler);

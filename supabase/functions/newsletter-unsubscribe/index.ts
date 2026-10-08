/**
 * Disiscrizione dalla newsletter.
 *
 * GET  ?token=...  link nell'email: NON cancella nulla, rimanda alla pagina
 *                  /newsletter del sito che chiede conferma. I filtri antispam
 *                  aprono i link in anticipo e prima disiscrivevano le persone.
 * POST             cancella l'iscrizione. Token nel body JSON (pulsante della
 *                  pagina) oppure nella query: è il "disiscriviti" con un clic
 *                  dei client email (RFC 8058, header List-Unsubscribe-Post).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const siteUrl = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
  const url = new URL(req.url);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    const target = UUID_RE.test(token)
      ? `${siteUrl}/newsletter?azione=disiscrizione&token=${encodeURIComponent(token)}`
      : `${siteUrl}/newsletter?esito=link-non-valido`;
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target } });
  }

  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  try {
    let token = url.searchParams.get("token") ?? "";
    if (!token && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token : "";
    }
    if (!UUID_RE.test(token)) return json({ error: "Token non valido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: deleted, error } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("unsubscribe_token", token)
      .select("id");

    if (error) {
      console.error("Delete error:", error);
      return json({ error: "Errore durante la disiscrizione" }, 500);
    }
    if (!deleted || deleted.length === 0) return json({ error: "Link non valido o già utilizzato" }, 404);

    console.log("Newsletter unsubscribed:", deleted[0].id);
    return json({ success: true });
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    return json({ error: "Errore interno del server" }, 500);
  }
};

serve(handler);

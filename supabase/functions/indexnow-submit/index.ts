import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { submitToIndexNow, toSiteUrls } from "../_shared/indexnow.ts";

/**
 * Ping IndexNow su richiesta dell'admin (es. BlogEditor dopo aver pubblicato un
 * articolo). Il browser non può chiamare api.indexnow.org direttamente (CORS/CSP),
 * quindi passa da qui. Solo URL del dominio, max 100 per chiamata.
 */

const BodySchema = z.object({
  urls: z.array(z.string().min(1).max(500)).min(1).max(100),
});

const json = (body: unknown, status: number, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const limited = await rateLimit(req, { endpoint: "indexnow-submit", maxRequests: 60, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Solo admin autenticati
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401, corsHeaders);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Non autorizzato" }, 401, corsHeaders);

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin possono inviare URL a IndexNow" }, 403, corsHeaders);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Body non valido: atteso { urls: string[] }" }, 400, corsHeaders);

    const urls = toSiteUrls(parsed.data.urls);
    if (!urls.length) return json({ error: "Nessuna URL valida del dominio" }, 400, corsHeaders);

    const result = await submitToIndexNow(urls);
    return json(result, result.ok ? 200 : 502, corsHeaders);
  } catch (e) {
    console.error("indexnow-submit:", e);
    return json({ error: "Errore interno" }, 500, corsHeaders);
  }
});

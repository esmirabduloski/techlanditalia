/**
 * Rate limiting condiviso per le edge function.
 * Usa la RPC `check_rate_limit` già presente nel database.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Restituisce una Response 429 se il limite è superato, altrimenti null.
 */
export async function rateLimit(
  req: Request,
  opts: {
    endpoint: string;
    maxRequests: number;
    windowSeconds: number;
    identifier?: string;
    corsHeaders: Record<string, string>;
  },
): Promise<Response | null> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data } = await supabase.rpc("check_rate_limit", {
      _identifier: opts.identifier || clientIp(req),
      _endpoint: opts.endpoint,
      _max_requests: opts.maxRequests,
      _window_seconds: opts.windowSeconds,
    });

    if (data && data.allowed === false) {
      const retryAfter = String(data.retry_after_seconds || opts.windowSeconds);
      await supabase.from("security_events").insert({
        event_type: "rate_limit_exceeded",
        ip_address: clientIp(req),
        endpoint: opts.endpoint,
        severity: "warn",
        metadata: { retry_after: retryAfter },
      });
      return new Response(
        JSON.stringify({ error: "Troppe richieste, riprova più tardi." }),
        {
          status: 429,
          headers: {
            ...opts.corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfter,
          },
        },
      );
    }
  } catch (e) {
    // Un errore del limiter non deve bloccare la funzione
    console.error("[ratelimit] error", e);
  }
  return null;
}

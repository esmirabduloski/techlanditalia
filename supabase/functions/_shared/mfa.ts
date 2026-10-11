/**
 * Verifica in due passaggi (MFA nativa di Supabase) lato edge function.
 *
 * Il service role ignora le policy RLS, quindi le funzioni che agiscono come
 * admin devono controllare da sole che la sessione del chiamante sia aal2
 * (nel database la regola è in public.mfa_required, migrazione 0019).
 *
 * Il token va validato prima con auth.getUser(token): qui si leggono solo i
 * claim, senza ricontrollare la firma.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AmrEntry {
  method: string;
  timestamp: number;
}

export interface SessionClaims {
  aal?: string;
  amr?: AmrEntry[];
}

export function decodeClaims(token: string): SessionClaims {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return JSON.parse(json) as SessionClaims;
  } catch {
    return {};
  }
}

/** true se nella sessione c'è un'autenticazione con uno dei metodi indicati, fatta da meno di maxAgeSeconds. */
export function hasRecentAuth(claims: SessionClaims, methods: string[], maxAgeSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (claims.amr ?? []).some(
    (a) => methods.includes(a.method) && now - a.timestamp <= maxAgeSeconds,
  );
}

export async function hasVerifiedFactor(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw error;
  return (data?.factors ?? []).some((f) => f.status === "verified");
}

export function mfaRequiredResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Verifica in due passaggi richiesta", mfa_required: true }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

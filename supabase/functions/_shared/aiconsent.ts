/**
 * Consenso agli strumenti AI (L. 132/2025, art. 4 c. 4; migrazione
 * 0054_ai_parental_consent). Ogni edge function che manda dati di uno studente
 * a un modello AI chiama requireAiConsent prima della richiesta: il service
 * role ignora le policy, quindi il controllo va fatto qui.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** null = può procedere; altrimenti la risposta 403 da restituire così com'è. */
export async function requireAiConsent(
  admin: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  // Genitori, insegnanti e admin sono adulti: il consenso serve solo agli studenti.
  // Senza profilo si nega, come per uno studente senza consenso.
  if (profile && profile.role !== "student") return null;

  const { data: allowed, error } = await admin.rpc("ai_access_allowed", { _student: userId });
  if (error) throw error;
  if (allowed === true) return null;

  return new Response(
    JSON.stringify({
      error: "Per usare gli strumenti AI serve il permesso di un genitore",
      ai_consent_required: true,
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

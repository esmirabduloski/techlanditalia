/**
 * Blocco del login per troppi tentativi falliti, visto dall'admin.
 *
 * Il blocco nasce da login_attempts (check_login_rate_limit): 5 errori in
 * 15 minuti per il login con email, 10 per gli alunni con username
 * (student-login). Qui l'admin:
 *   - status: elenca gli account bloccati in questo momento;
 *   - unlock: cancella i tentativi falliti di un utente, che rientra subito
 *     senza aspettare i minuti del messaggio di sistema.
 * Solo admin con sessione aal2.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";

// Stesse soglie di student-login e check-login-attempts
const EMAIL_MAX_ATTEMPTS = 5;
const STUDENT_MAX_ATTEMPTS = 10;
const LOCK_WINDOW_MINUTES = 15;

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("unlock"), userId: z.string().uuid() }),
]);

type Admin = ReturnType<typeof createClient>;

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const limited = await rateLimit(req, { endpoint: "admin-login-lock", maxRequests: 300, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin possono sbloccare gli account" }, 403);

    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dati non validi" }, 400);

    if (parsed.data.action === "status") return json(await lockStatus(admin));

    const { userId } = parsed.data;
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    const email = target?.user?.email?.toLowerCase();
    if (targetError || !email) return json({ error: "Utente non trovato" }, 404);

    const { error: deleteError, count } = await admin
      .from("login_attempts")
      .delete({ count: "exact" })
      .eq("email", email)
      .eq("success", false);
    if (deleteError) {
      console.error("[admin-login-lock] delete:", deleteError.message);
      return json({ error: "Impossibile sbloccare l'account" }, 500);
    }

    console.log(`[admin-login-lock] utente ${userId} sbloccato dall'admin ${user.id} (${count ?? 0} tentativi cancellati)`);
    return json({ success: true, cleared: count ?? 0 });
  } catch (error) {
    console.error("[admin-login-lock]", error);
    return json({ error: "Errore interno del server" }, 500);
  }
});

// Account bloccati adesso: tentativi falliti negli ultimi 15 minuti oltre soglia
async function lockStatus(admin: Admin) {
  const since = new Date(Date.now() - LOCK_WINDOW_MINUTES * 60_000).toISOString();
  const { data: attempts, error } = await admin
    .from("login_attempts")
    .select("email, attempted_at")
    .eq("success", false)
    .gt("attempted_at", since);
  if (error) throw new Error(`login_attempts: ${error.message}`);

  const byEmail = new Map<string, { count: number; oldest: string }>();
  for (const a of (attempts ?? []) as { email: string; attempted_at: string }[]) {
    const key = a.email.toLowerCase();
    const cur = byEmail.get(key);
    if (!cur) byEmail.set(key, { count: 1, oldest: a.attempted_at });
    else {
      cur.count++;
      if (a.attempted_at < cur.oldest) cur.oldest = a.attempted_at;
    }
  }
  const candidates = [...byEmail.entries()].filter(([, v]) => v.count >= EMAIL_MAX_ATTEMPTS);
  if (candidates.length === 0) return { locked: [] };

  // Gli alunni hanno un'email tecnica in auth.users, diversa da profiles.email:
  // l'abbinamento email → utente si fa su auth.users.
  const wanted = new Set(candidates.map(([email]) => email));
  const idByEmail = new Map<string, string>();
  for (let page = 1; idByEmail.size < wanted.size; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw new Error(`listUsers: ${listError.message}`);
    for (const u of data.users) {
      const email = u.email?.toLowerCase();
      if (email && wanted.has(email)) idByEmail.set(email, u.id);
    }
    if (data.users.length < 1000) break;
  }

  const ids = [...idByEmail.values()];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, role").in("id", ids)
    : { data: [] };
  const roleById = new Map(((profiles ?? []) as { id: string; role: string }[]).map((p) => [p.id, p.role]));

  const locked = candidates.flatMap(([email, v]) => {
    const userId = idByEmail.get(email);
    if (!userId) return [];
    const isStudent = roleById.get(userId) === "student";
    // Un alunno con 5-9 errori non entra più con l'email, ma con lo username sì
    if (isStudent && v.count < STUDENT_MAX_ATTEMPTS) return [];
    const retryAfterSeconds = Math.max(
      1,
      Math.round((new Date(v.oldest).getTime() + LOCK_WINDOW_MINUTES * 60_000 - Date.now()) / 1000),
    );
    return [{ userId, failedAttempts: v.count, retryAfterSeconds }];
  });
  return { locked };
}

/**
 * Collegamento dell'account Google dell'insegnante (Google Calendar), dalla
 * dashboard. Solo insegnanti con verifica in due passaggi; JWT controllato qui.
 *
 * POST { action }:
 *   - "status": se il collegamento è disponibile (segreti impostati) e lo stato
 *     di quello dell'insegnante;
 *   - "start": URL di autorizzazione Google (state + PKCE in google_oauth_states);
 *   - "finish" { code, state }: Google rimanda a /insegnante/google-calendar,
 *     la pagina passa qui il codice: si scambia, si crea (o si ritrova) il
 *     calendario «TECHLAND · Lezioni» e si copiano subito le lezioni;
 *   - "sync": "Aggiorna ora";
 *   - "disconnect": elimina il calendario da Google, revoca l'accesso e
 *     cancella il collegamento.
 *
 * Segreti: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET (client
 * OAuth "Applicazione web" con redirect URI https://techlanditalia.it/insegnante/google-calendar).
 * Senza segreti "status" risponde configured: false e la dashboard offre solo il link .ics.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError } from "../_shared/sentry.ts";
import {
  authorizationUrl,
  calendarApi,
  emailFromIdToken,
  exchangeCode,
  type GoogleConfig,
  GoogleError,
  googleConfig,
  hasCalendarScope,
  pkceChallenge,
  randomToken,
  refreshAccessToken,
  revokeToken,
  STATE_RE,
} from "../_shared/googlecalendar.ts";
import { type Connection, syncConnection } from "../_shared/googlecalendarsync.ts";
import { isTeacher } from "../_shared/teacherlessons.ts";

const FN = "google-calendar";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
const STATE_MAX_AGE_MS = 15 * 60_000;

type Body = { action?: string; code?: string; state?: string };

async function connectionStatus(supabase: SupabaseClient, teacherId: string) {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("google_email, status, last_error, last_synced_at, dirty_at, connected_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    google_email: data.google_email,
    status: data.status,
    last_error: data.last_error,
    last_synced_at: data.last_synced_at,
    pending: data.dirty_at !== null,
    connected_at: data.connected_at,
  };
}

async function loadConnection(supabase: SupabaseClient, teacherId: string) {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("teacher_id, refresh_token, calendar_id, dirty_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return data as Connection | null;
}

async function finish(
  supabase: SupabaseClient,
  cfg: GoogleConfig,
  teacherId: string,
  body: Body,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const state = body.state ?? "";
  const code = body.code ?? "";
  if (!STATE_RE.test(state) || !code || code.length > 2048) {
    return { status: 400, body: { error: "Richiesta di collegamento non valida", reason: "invalid_request" } };
  }

  // La richiesta si usa una volta sola, e solo da chi l'ha avviata
  const { data: pending, error: stateError } = await supabase
    .from("google_oauth_states")
    .delete()
    .eq("state", state)
    .eq("teacher_id", teacherId)
    .select("code_verifier, created_at")
    .maybeSingle();
  if (stateError) throw stateError;
  if (!pending || Date.now() - Date.parse(pending.created_at) > STATE_MAX_AGE_MS) {
    return { status: 400, body: { error: "Il collegamento è scaduto: riprova dalla dashboard", reason: "expired" } };
  }

  let tokens;
  try {
    tokens = await exchangeCode(cfg, code, pending.code_verifier);
  } catch (e) {
    // Codice già usato o scaduto (es. pagina ricaricata): si ricomincia
    if (e instanceof GoogleError && e.status === 400) {
      return { status: 400, body: { error: "Google non ha confermato il collegamento: riprova dalla dashboard", reason: "invalid_grant" } };
    }
    throw e;
  }
  if (!hasCalendarScope(tokens.scope)) {
    // L'insegnante ha tolto la spunta sul calendario nella schermata di Google
    if (tokens.refresh_token) await revokeToken(tokens.refresh_token);
    return {
      status: 400,
      body: { error: "Serve il permesso di gestire il calendario TECHLAND: riprova e lascialo selezionato", reason: "scope_missing" },
    };
  }
  if (!tokens.refresh_token) {
    return { status: 400, body: { error: "Google non ha concesso l'accesso continuativo: riprova", reason: "no_refresh_token" } };
  }

  const api = calendarApi(tokens.access_token);
  const previous = await loadConnection(supabase, teacherId);
  // Ricollegando si riusa il calendario di prima, se c'è ancora
  const calendarId = previous?.calendar_id && (await api.calendarExists(previous.calendar_id))
    ? previous.calendar_id
    : await api.createCalendar();

  const { error: upsertError } = await supabase.from("google_calendar_connections").upsert({
    teacher_id: teacherId,
    google_email: emailFromIdToken(tokens.id_token),
    refresh_token: tokens.refresh_token,
    calendar_id: calendarId,
    status: "active",
    last_error: null,
    dirty_at: new Date().toISOString(),
    retry_after: null,
    connected_at: new Date().toISOString(),
  });
  if (upsertError) throw upsertError;
  if (previous && previous.refresh_token !== tokens.refresh_token) await revokeToken(previous.refresh_token);

  const conn = await loadConnection(supabase, teacherId);
  const outcome = await syncConnection(supabase, cfg, conn!, { siteUrl: SITE_URL });
  return {
    status: 200,
    body: { ok: true, sync: outcome, connection: await connectionStatus(supabase, teacherId) },
  };
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
  const token = auth.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Non autorizzato" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Richiesta non valida" }, 400);
  }

  try {
    if (!(await isTeacher(supabase, user.id))) return json({ error: "Solo per gli insegnanti" }, 403);
    // Gli insegnanti hanno sempre la verifica in due passaggi (public.mfa_required)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const cfg = googleConfig((k) => Deno.env.get(k));

    switch (body.action) {
      case "status":
        return json({ configured: !!cfg, connection: cfg ? await connectionStatus(supabase, user.id) : null });

      case "start": {
        if (!cfg) return json({ error: "Collegamento a Google non ancora attivo", reason: "not_configured" }, 503);
        const state = randomToken();
        const verifier = randomToken(48);
        await supabase.from("google_oauth_states").delete().eq("teacher_id", user.id);
        const { error } = await supabase
          .from("google_oauth_states")
          .insert({ state, teacher_id: user.id, code_verifier: verifier });
        if (error) throw error;
        return json({ url: authorizationUrl(cfg, state, await pkceChallenge(verifier)) });
      }

      case "finish": {
        if (!cfg) return json({ error: "Collegamento a Google non ancora attivo", reason: "not_configured" }, 503);
        const res = await finish(supabase, cfg, user.id, body);
        return json(res.body, res.status);
      }

      case "sync": {
        if (!cfg) return json({ error: "Collegamento a Google non ancora attivo", reason: "not_configured" }, 503);
        const conn = await loadConnection(supabase, user.id);
        if (!conn) return json({ error: "Google Calendar non collegato", reason: "not_connected" }, 404);
        const outcome = await syncConnection(supabase, cfg, conn, { siteUrl: SITE_URL });
        return json({ ok: outcome.ok, sync: outcome, connection: await connectionStatus(supabase, user.id) });
      }

      case "disconnect": {
        const conn = await loadConnection(supabase, user.id);
        if (conn && cfg) {
          // Il calendario se ne va da Google insieme al collegamento (se si può ancora)
          try {
            const accessToken = await refreshAccessToken(cfg, conn.refresh_token);
            if (conn.calendar_id) await calendarApi(accessToken).deleteCalendar(conn.calendar_id);
          } catch (e) {
            console.warn(`[${FN}] calendario non eliminato:`, e instanceof Error ? e.message : e);
          }
          await revokeToken(conn.refresh_token);
        }
        const { error } = await supabase.from("google_calendar_connections").delete().eq("teacher_id", user.id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "Azione non valida" }, 400);
    }
  } catch (e) {
    await captureServerError(e, { fn: FN, extra: { action: body.action } });
    return json({ error: "Google Calendar non raggiungibile, riprova tra poco" }, 500);
  }
});

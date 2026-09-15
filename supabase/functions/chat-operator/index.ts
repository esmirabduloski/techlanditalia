/**
 * Chat pubblica del sito: richiesta di un operatore umano + polling dei messaggi.
 *
 * POST { action: "request", sessionId, lastQuestion? }  -> segna la richiesta e avvisa gli admin
 * POST { action: "poll", sessionId, since? }            -> restituisce i messaggi dell'operatore
 *                                                          (+ `ended: true` se l'operatore ha chiuso la chat)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";

const BodySchema = z.object({
  action: z.enum(["request", "poll"]),
  sessionId: z.string().min(8).max(120),
  lastQuestion: z.string().max(1000).optional(),
  since: z.string().max(40).optional(),
  // Recapito lasciato dal visitatore per essere ricontattato se nessun operatore è disponibile
  contact: z.string().trim().min(5).max(120).optional(),
  contactType: z.enum(["email", "phone"]).optional(),
});

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, sessionId, lastQuestion, since, contact, contactType } = parsed.data;

    if (action === "request") {
      const limited = await rateLimit(req, {
        endpoint: "chat-operator-request",
        maxRequests: 10,
        windowSeconds: 3600,
        corsHeaders,
      });
      if (limited) return limited;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const CONV_FIELDS = "id, operator_requested_at, operator_joined_at, ended_at, metadata";

    let { data: conv } = await supabase
      .from("chat_conversations")
      .select(CONV_FIELDS)
      .eq("session_id", sessionId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conv && action === "poll") {
      // Nessuna chat aperta: se l'ultima è stata chiusa dall'operatore restituiamo comunque
      // i suoi messaggi finali (es. il saluto) e segnaliamo al widget che la chat è terminata.
      const { data: lastConv } = await supabase
        .from("chat_conversations")
        .select(CONV_FIELDS)
        .eq("session_id", sessionId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastConv) return json({ operatorActive: false, operatorRequested: false, ended: false, messages: [] });
      conv = lastConv;
    }

    if (!conv) {
      // Il visitatore può chiedere un operatore prima di scrivere: creiamo la conversazione.
      const { data: created, error: createError } = await supabase
        .from("chat_conversations")
        .insert({ session_id: sessionId, last_message_at: new Date().toISOString() })
        .select(CONV_FIELDS)
        .single();
      if (createError || !created) {
        console.error("[chat-operator] create conversation", createError);
        return json({ error: "Errore interno" }, 500);
      }
      conv = created;
    }

    if (action === "poll") {
      let query = supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conv.id)
        .eq("role", "operator")
        .order("created_at", { ascending: true })
        .limit(100);
      if (since) query = query.gt("created_at", since);
      const { data: messages } = await query;
      const ended = Boolean(conv.ended_at);
      return json({
        operatorActive: !ended && Boolean(conv.operator_joined_at),
        operatorRequested: !ended && Boolean(conv.operator_requested_at),
        ended,
        messages: messages ?? [],
      });
    }

    // action === "request"
    if (!conv.operator_requested_at) {
      await supabase
        .from("chat_conversations")
        .update({ operator_requested_at: new Date().toISOString() })
        .eq("id", conv.id);

      const task = notifyAdmins({
        title: "Richiesta operatore in chat",
        body: lastQuestion?.slice(0, 160) || "Un visitatore vuole parlare con un operatore.",
        // Il click sulla notifica apre direttamente questa conversazione nell'admin
        path: `/admin/chat-live?conversation=${conv.id}`,
        type: "chat_operator_request",
        tag: `chat-${conv.id}`,
      });
      try {
        // @ts-ignore EdgeRuntime disponibile su Supabase Edge Functions
        EdgeRuntime.waitUntil(task);
      } catch {
        task.catch(() => undefined);
      }
    }

    return json({ success: true, operatorActive: Boolean(conv.operator_joined_at) });
  } catch (error) {
    console.error("[chat-operator]", error);
    return json({ error: "Errore interno" }, 500);
  }
});

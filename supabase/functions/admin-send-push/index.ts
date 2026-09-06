import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

const BodySchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(300),
  path: z.string().max(200).optional(),
  // destinatari: elenco di utenti, oppure "tutti i genitori" / "tutti gli insegnanti"
  userIds: z.array(z.string().uuid()).max(500).optional(),
  audience: z.enum(["all", "parents", "teachers"]).optional(),
});

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const limited = await rateLimit(req, {
    endpoint: "admin-send-push",
    maxRequests: 60,
    windowSeconds: 3600,
    corsHeaders,
  });
  if (limited) return limited;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Non autorizzato" }, 401);

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin possono inviare notifiche" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { title, body, path, userIds, audience } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!LOVABLE_API_KEY || !CONNECTION_KEY) {
      return json({ error: "Firebase Cloud Messaging non collegato al progetto" }, 503);
    }

    // Determina i destinatari
    let targets: string[] = userIds ?? [];
    if (!userIds || userIds.length === 0) {
      const { data: registered } = await supabase.from("push_devices").select("user_id");
      let ids = Array.from(new Set((registered ?? []).map((d) => d.user_id as string)));

      if (audience === "teachers") {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "teacher");
        const teacherIds = new Set((roles ?? []).map((r) => r.user_id as string));
        ids = ids.filter((id) => teacherIds.has(id));
      } else if (audience === "parents") {
        const { data: parents } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "parent")
          .in("id", ids);
        const parentIds = new Set((parents ?? []).map((p) => p.id as string));
        ids = ids.filter((id) => parentIds.has(id));
      }
      targets = ids;
    }

    if (targets.length === 0) return json({ error: "Nessun destinatario con notifiche attive" }, 400);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of targets) {
      const { data: devices } = await supabase
        .from("push_devices")
        .select("id, token")
        .eq("user_id", userId);

      let ok = 0;
      let ko = 0;
      for (const device of devices ?? []) {
        const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": CONNECTION_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title, body },
              data: { path: path ?? "/area-riservata" },
            },
          }),
        });
        if (res.ok) { ok++; sent++; } else {
          ko++;
          failed++;
          const text = await res.text();
          console.error(`[admin-send-push] FCM ${res.status}: ${text}`);
          if (res.status === 404 || res.status === 400) {
            await supabase.from("push_devices").delete().eq("id", device.id as string);
          } else if (errors.length < 5) {
            errors.push(`${res.status}: ${text.slice(0, 200)}`);
          }
        }
      }

      await supabase.from("push_notification_log").insert({
        user_id: userId,
        notification_type: "manual_admin",
        title,
        body,
        success_count: ok,
        failure_count: ko,
      });
    }

    return json({ success: true, recipients: targets.length, sent, failed, errors });
  } catch (error) {
    console.error("[admin-send-push]", error);
    return json({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});

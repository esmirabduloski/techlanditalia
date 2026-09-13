/**
 * Invio notifiche push a tutti gli amministratori con notifiche attive.
 * Non blocca mai il flusso chiamante: eventuali errori vengono solo loggati.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

export async function notifyAdmins(opts: {
  title: string;
  body: string;
  /** Percorso del sito da aprire al click sulla notifica (es. /admin/chat-live?conversation=…). */
  path?: string;
  type?: string;
  /** Notifiche con lo stesso tag si sostituiscono a vicenda invece di accumularsi. */
  tag?: string;
}): Promise<void> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!LOVABLE_API_KEY || !CONNECTION_KEY) {
      console.warn("[notifyAdmins] Firebase non configurato, notifica saltata");
      return;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id as string)));
    if (adminIds.length === 0) return;

    const { data: devices } = await supabase
      .from("push_devices")
      .select("id, token, user_id")
      .in("user_id", adminIds);
    if (!devices || devices.length === 0) return;

    const path = opts.path ?? "/admin/crm";
    const link = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    const perUser = new Map<string, { ok: number; ko: number }>();

    for (const device of devices) {
      const userId = device.user_id as string;
      const stats = perUser.get(userId) ?? { ok: 0, ko: 0 };
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
            notification: { title: opts.title, body: opts.body },
            // `path` viene letto dal service worker (public/firebase-messaging-sw.js)
            // e dalla pagina in primo piano per aprire la sezione giusta dell'admin.
            data: { path, link, type: opts.type ?? "admin_alert" },
            webpush: {
              notification: {
                icon: `${SITE_URL}/favicon.png`,
                ...(opts.tag ? { tag: opts.tag } : {}),
              },
              // Fallback usato dall'SDK Firebase se il nostro handler non intercetta il click.
              fcm_options: { link },
            },
          },
        }),
      });
      if (res.ok) {
        stats.ok++;
      } else {
        stats.ko++;
        const text = await res.text();
        console.error(`[notifyAdmins] FCM ${res.status}: ${text}`);
        if (res.status === 404 || res.status === 400) {
          await supabase.from("push_devices").delete().eq("id", device.id as string);
        }
      }
      perUser.set(userId, stats);
    }

    for (const [userId, stats] of perUser) {
      await supabase.from("push_notification_log").insert({
        user_id: userId,
        notification_type: opts.type ?? "admin_alert",
        title: opts.title,
        body: opts.body,
        success_count: stats.ok,
        failure_count: stats.ko,
      });
    }
  } catch (e) {
    console.error("[notifyAdmins] errore", e);
  }
}

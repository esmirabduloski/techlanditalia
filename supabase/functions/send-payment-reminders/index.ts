import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";

/**
 * Promemoria dei pagamenti CRM (tabella crm_payments).
 * - Job giornaliero (cron con x-cron-token): per le rate da incassare con
 *   reminder_date <= oggi invia una push agli admin ("chiedi il pagamento") e,
 *   se attivato, una push al cliente ("rata in scadenza").
 * - Stesso job: solleciti delle rate scadute e non pagate, secondo le regole in
 *   site_settings.crm_payment_dunning (dopo quanti giorni, ogni quanti, quante volte).
 * - Admin autenticato con { paymentId }: invia subito il promemoria al cliente
 *   (testo di sollecito se la rata è già scaduta).
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
// Al cliente non mandiamo promemoria troppo vecchi (es. rate create con date già passate)
const CLIENT_MAX_DELAY_DAYS = 3;

type DunningSettings = {
  enabled: boolean;
  first_after_days: number;
  repeat_every_days: number;
  max_reminders: number;
  notify_client: boolean;
};

const DEFAULT_DUNNING: DunningSettings = {
  enabled: true,
  first_after_days: 3,
  repeat_every_days: 7,
  max_reminders: 3,
  notify_client: false,
};

type PaymentRow = {
  id: string;
  lead_id: string;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  reminder_date: string | null;
  installment_number: number | null;
  installment_total: number | null;
  remind_admin: boolean;
  remind_client: boolean;
  admin_reminder_sent_at: string | null;
  client_reminder_sent_at: string | null;
  overdue_reminder_count: number;
  last_overdue_reminder_at: string | null;
  crm_leads: { full_name: string | null; linked_profile_id: string | null } | null;
};

const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : "";

/** Data di oggi (YYYY-MM-DD) nel fuso di Roma. */
function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** "la rata 3/10 (Corso Python Base)", "il pagamento per Corso Scratch", "il pagamento". */
function paymentPhrase(p: PaymentRow): string {
  const desc = p.description?.trim();
  if (p.installment_number && p.installment_total) {
    return `la rata ${p.installment_number}/${p.installment_total}${desc ? ` (${desc})` : ""}`;
  }
  return desc ? `il pagamento per ${desc}` : "il pagamento";
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Solo il cron (token interno) o un admin autenticato
  let isCron = false;
  let isAdmin = false;
  const cronToken = req.headers.get("x-cron-token") ?? "";
  if (cronToken) {
    const { data: ok } = await supabase.rpc("verify_cron_token", { _name: "send-payment-reminders", _token: cronToken });
    isCron = ok === true;
  }
  if (!isCron) {
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
      if (user) {
        const { data: role } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        isAdmin = Boolean(role);
      }
    }
  }
  if (!isCron && !isAdmin) return json({ error: "Non autorizzato" }, 401);

  let body: { paymentId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vuoto: esecuzione del job giornaliero
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !CONNECTION_KEY) {
    return json({ error: "Firebase Cloud Messaging non collegato al progetto" }, 503);
  }

  /**
   * Push al cliente: restituisce l'esito da salvare in client_reminder_result.
   * `overdue` = sollecito di una rata già scaduta.
   */
  const sendToClient = async (
    p: PaymentRow,
    kind: "reminder" | "overdue" = "reminder",
  ): Promise<"sent" | "no_account" | "no_devices" | "failed"> => {
    const userId = p.crm_leads?.linked_profile_id;
    if (!userId) return "no_account";

    const { data: devices } = await supabase.from("push_devices").select("id, token").eq("user_id", userId);
    if (!devices || devices.length === 0) return "no_devices";

    const firstName = p.crm_leads?.full_name?.trim().split(/\s+/)[0] ?? "";
    const greeting = firstName ? `Ciao ${firstName}, ` : "";
    const title = kind === "overdue" ? "Pagamento da saldare" : "Promemoria pagamento";
    const text = kind === "overdue"
      ? `${greeting}risulta ancora da saldare ${paymentPhrase(p)} di ${euro(p.amount_cents)}${p.due_date ? `, con scadenza il ${shortDate(p.due_date)}` : ""}. Se hai già pagato, ignora questo messaggio. Grazie!`
      : `${greeting}${firstName ? "ti" : "Ti"} ricordiamo ${paymentPhrase(p)} di ${euro(p.amount_cents)}${p.due_date ? ` in scadenza il ${shortDate(p.due_date)}` : ""}. Grazie!`;
    const path = "/area-riservata/acquisti";
    const link = `${SITE_URL}${path}`;

    let ok = 0;
    let ko = 0;
    for (const device of devices) {
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
            notification: { title, body: text },
            data: { path, link, type: kind === "overdue" ? "payment_overdue" : "payment_reminder" },
            webpush: {
              notification: { icon: `${SITE_URL}/favicon.png`, tag: `payment-${p.id}` },
              fcm_options: { link },
            },
          },
        }),
      });
      if (res.ok) {
        ok++;
      } else {
        ko++;
        const errText = await res.text();
        console.error(`[send-payment-reminders] FCM ${res.status}: ${errText}`);
        if (res.status === 404 || res.status === 400) {
          await supabase.from("push_devices").delete().eq("id", device.id as string);
        }
      }
    }

    await supabase.from("push_notification_log").insert({
      user_id: userId,
      notification_type: kind === "overdue" ? "payment_overdue" : "payment_reminder",
      title,
      body: text,
      success_count: ok,
      failure_count: ko,
    });
    return ok > 0 ? "sent" : "failed";
  };

  const select =
    "id, lead_id, amount_cents, description, due_date, reminder_date, installment_number, installment_total, remind_admin, remind_client, admin_reminder_sent_at, client_reminder_sent_at, overdue_reminder_count, last_overdue_reminder_at, crm_leads(full_name, linked_profile_id)";

  /** Solleciti delle rate scadute e non pagate. */
  const runDunning = async (today: string) => {
    const { data: setting } = await supabase
      .from("site_settings").select("value").eq("key", "crm_payment_dunning").maybeSingle();
    const rules: DunningSettings = { ...DEFAULT_DUNNING, ...((setting?.value as Partial<DunningSettings>) ?? {}) };
    if (!rules.enabled || rules.max_reminders <= 0) return { enabled: false, sent: 0 };

    const firstAfter = Math.max(0, rules.first_after_days);
    const repeatEvery = Math.max(1, rules.repeat_every_days);
    const latestDue = new Date(Date.parse(`${today}T00:00:00Z`) - firstAfter * 86_400_000).toISOString().slice(0, 10);

    const { data: overdueRows, error } = await supabase
      .from("crm_payments")
      .select(select)
      .eq("status", "scheduled")
      .lte("due_date", latestDue)
      .lt("overdue_reminder_count", rules.max_reminders);
    if (error) throw error;

    const due = ((overdueRows ?? []) as unknown as PaymentRow[]).filter((p) => {
      if (!p.last_overdue_reminder_at) return true;
      const last = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(p.last_overdue_reminder_at));
      return daysBetween(last, today) >= repeatEvery;
    });
    if (due.length === 0) return { enabled: true, sent: 0 };

    const total = due.reduce((s, p) => s + p.amount_cents, 0);
    const describe = (p: PaymentRow) =>
      `${p.crm_leads?.full_name || "Cliente"} ${euro(p.amount_cents)}${p.due_date ? ` (da ${daysBetween(p.due_date, today)} gg)` : ""}`;
    await notifyAdmins(
      due.length === 1
        ? {
          title: `⚠️ Rata scaduta: ${due[0].crm_leads?.full_name || "un cliente"}`,
          body: `${capitalize(paymentPhrase(due[0]))} di ${euro(due[0].amount_cents)} risulta ancora da pagare${due[0].due_date ? `, con scadenza il ${shortDate(due[0].due_date)}` : ""}`,
          path: `/admin/crm?lead=${due[0].lead_id}`,
          type: "payment_overdue_admin",
          tag: "payment-overdue",
        }
        : {
          title: `⚠️ ${due.length} rate scadute da sollecitare (${euro(total)})`,
          body: due.slice(0, 4).map(describe).join(" · ") + (due.length > 4 ? ` · +${due.length - 4}` : ""),
          path: "/admin/crm?tab=scadenziario",
          type: "payment_overdue_admin",
          tag: "payment-overdue",
        },
    );

    const now = new Date().toISOString();
    let clientSent = 0;
    for (const p of due) {
      let clientResult: string | null = null;
      if (rules.notify_client && p.remind_client) {
        clientResult = await sendToClient(p, "overdue");
        if (clientResult === "sent") clientSent++;
      }
      const count = p.overdue_reminder_count + 1;
      await supabase.from("crm_payments")
        .update({ overdue_reminder_count: count, last_overdue_reminder_at: now })
        .eq("id", p.id);
      // Traccia nella timeline del cliente
      await supabase.from("crm_interactions").insert({
        lead_id: p.lead_id,
        type: "note",
        subject: `Sollecito automatico ${count}/${rules.max_reminders}`,
        content: `${capitalize(paymentPhrase(p))} di ${euro(p.amount_cents)}, scadenza ${shortDate(p.due_date)}.` +
          (clientResult === "sent" ? " Notifica inviata anche al cliente." : ""),
        metadata: { payment_id: p.id, automatic: true, client_result: clientResult },
      });
    }
    return { enabled: true, sent: due.length, clientSent };
  };

  try {
    // Invio manuale dall'admin: promemoria immediato al cliente per una rata
    if (body.paymentId) {
      if (!isAdmin) return json({ error: "Solo gli admin" }, 403);
      const { data: payment } = await supabase
        .from("crm_payments").select(select).eq("id", body.paymentId).maybeSingle();
      if (!payment) return json({ error: "Pagamento non trovato" }, 404);
      const row = payment as unknown as PaymentRow;
      const kind = row.due_date && row.due_date < todayRome() ? "overdue" : "reminder";
      const result = await sendToClient(row, kind);
      await supabase.from("crm_payments")
        .update({ client_reminder_sent_at: new Date().toISOString(), client_reminder_result: result })
        .eq("id", body.paymentId);
      return json({ success: result === "sent", result });
    }

    const today = todayRome();
    const { data: due, error } = await supabase
      .from("crm_payments")
      .select(select)
      .eq("status", "scheduled")
      .lte("reminder_date", today)
      .or("and(remind_admin.eq.true,admin_reminder_sent_at.is.null),and(remind_client.eq.true,client_reminder_sent_at.is.null)");
    if (error) throw error;

    const payments = (due ?? []) as unknown as PaymentRow[];
    const now = new Date().toISOString();

    // Admin: una sola notifica riassuntiva per esecuzione
    const forAdmin = payments.filter((p) => p.remind_admin && !p.admin_reminder_sent_at);
    if (forAdmin.length > 0) {
      const lines = forAdmin.map((p) => `${p.crm_leads?.full_name || "Cliente"} ${euro(p.amount_cents)}`);
      const total = forAdmin.reduce((s, p) => s + p.amount_cents, 0);
      const single = forAdmin[0];
      await notifyAdmins(
        forAdmin.length === 1
          ? {
            title: `💶 Chiedi il pagamento a ${single.crm_leads?.full_name || "un cliente"}`,
            body: `${capitalize(paymentPhrase(single))} di ${euro(single.amount_cents)}${single.due_date ? ` (scadenza ${shortDate(single.due_date)})` : ""}`,
            path: `/admin/crm?lead=${single.lead_id}`,
            type: "payment_reminder_admin",
            tag: "payment-reminders",
          }
          : {
            title: `💶 ${forAdmin.length} pagamenti da chiedere oggi (${euro(total)})`,
            body: lines.slice(0, 4).join(" · ") + (lines.length > 4 ? ` · +${lines.length - 4}` : ""),
            path: "/admin/crm",
            type: "payment_reminder_admin",
            tag: "payment-reminders",
          },
      );
      await supabase.from("crm_payments")
        .update({ admin_reminder_sent_at: now })
        .in("id", forAdmin.map((p) => p.id));
    }

    // Cliente: una notifica per rata
    let clientSent = 0;
    for (const p of payments.filter((p) => p.remind_client && !p.client_reminder_sent_at)) {
      const tooOld = p.reminder_date && daysBetween(p.reminder_date, today) > CLIENT_MAX_DELAY_DAYS;
      const result = tooOld ? "skipped_old" : await sendToClient(p);
      if (result === "sent") clientSent++;
      await supabase.from("crm_payments")
        .update({ client_reminder_sent_at: now, client_reminder_result: result })
        .eq("id", p.id);
    }

    const dunning = await runDunning(today);

    return json({ success: true, today, adminReminders: forAdmin.length, clientSent, dunning });
  } catch (error) {
    console.error("[send-payment-reminders]", error);
    return json({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});

/**
 * Pulizia dei dati oltre i termini di conservazione (Privacy Policy, §2).
 *
 * POST { action: "scan", trigger?: "scheduled" | "manual" }
 *   Conta i record scaduti per categoria, crea/aggiorna una run "pending" e
 *   avvisa gli admin (push + email). NON cancella nulla. Chiamata dal cron
 *   mensile (chiave anon) o dalla pagina admin.
 * POST { action: "approve", runId, categories: string[] }   (solo admin)
 *   Esegue le DELETE per le categorie scelte e chiude la run come "executed".
 * POST { action: "reject", runId, note? }                    (solo admin)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";

const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_EMAILS = (Deno.env.get("RETENTION_NOTIFY_EMAILS") || "info@techlanditalia.it,infotechlanditalia@gmail.com")
  .split(",").map((e) => e.trim()).filter(Boolean);
/** Un avviso al mese basta: niente nuove email/push se l'ultimo è più recente di così. */
const RENOTIFY_AFTER_HOURS = 24 * 20;

type Category = {
  id: string;
  label: string;
  /** Termine di conservazione dichiarato in Privacy Policy. */
  months?: number;
  days?: number;
  basis: string;
};

/**
 * Termini: massimi difendibili, non minimi. Il GDPR non fissa numeri (art. 5.1.e,
 * limitazione della conservazione): 24 mesi è il riferimento del Garante per i
 * dati a fini commerciali di chi non è diventato cliente; le iscrizioni newsletter
 * mai confermate non hanno consenso e vanno rimosse in fretta. I dati di clienti
 * e studenti NON sono toccati da questo job (10 anni, obblighi fiscali).
 */
const CATEGORIES: Category[] = [
  { id: "trial_bookings", label: "Richieste di lezione di prova", months: 24, basis: "24 mesi dalla richiesta (dati precontrattuali/commerciali)" },
  { id: "contact_submissions", label: "Messaggi dal form contatti", months: 24, basis: "24 mesi dal messaggio" },
  { id: "job_applications", label: "Candidature (Lavora con noi)", months: 24, basis: "24 mesi dalla candidatura" },
  { id: "chat_conversations", label: "Conversazioni della chat del sito (con i messaggi)", months: 24, basis: "24 mesi dall'ultimo messaggio" },
  { id: "newsletter_unconfirmed", label: "Iscrizioni newsletter mai confermate", days: 30, basis: "30 giorni senza conferma (nessun consenso valido)" },
  { id: "crm_leads_stale", label: "Lead CRM non clienti senza attività", months: 24, basis: "24 mesi dall'ultima attività, esclusi i lead 'won' e quelli collegati a un account" },
];

const BodySchema = z.object({
  action: z.enum(["scan", "approve", "reject"]),
  trigger: z.enum(["scheduled", "manual"]).optional(),
  runId: z.string().uuid().optional(),
  categories: z.array(z.string()).max(20).optional(),
  note: z.string().max(500).optional(),
});

function cutoffFor(c: Category): string {
  const d = new Date();
  if (c.months) d.setMonth(d.getMonth() - c.months);
  if (c.days) d.setDate(d.getDate() - c.days);
  return d.toISOString();
}

type Db = ReturnType<typeof createClient>;

/** Query base per categoria: la stessa per contare e per cancellare. */
// deno-lint-ignore no-explicit-any
function scoped(db: Db, c: Category, mode: "count" | "delete"): any {
  const cutoff = cutoffFor(c);
  // deno-lint-ignore no-explicit-any
  const base = (t: string): any =>
    mode === "count"
      ? db.from(t).select("id", { count: "exact", head: true })
      : db.from(t).delete().select("id");
  switch (c.id) {
    case "trial_bookings": return base("trial_bookings").lt("created_at", cutoff);
    case "contact_submissions": return base("contact_submissions").lt("created_at", cutoff);
    case "job_applications": return base("job_applications").lt("created_at", cutoff);
    case "chat_conversations": return base("chat_conversations").lt("last_message_at", cutoff);
    case "newsletter_unconfirmed": return base("newsletter_subscribers").eq("confirmed", false).lt("created_at", cutoff);
    case "crm_leads_stale":
      return base("crm_leads")
        .neq("pipeline_stage", "won")
        .is("linked_profile_id", null)
        .lt("updated_at", cutoff)
        .or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoff}`);
    default: throw new Error(`categoria sconosciuta: ${c.id}`);
  }
}

async function buildSummary(db: Db) {
  const rows = [];
  for (const c of CATEGORIES) {
    const { count, error } = await scoped(db, c, "count");
    if (error) console.error(`[data-retention] count ${c.id}`, error.message);
    rows.push({ id: c.id, label: c.label, basis: c.basis, cutoff: cutoffFor(c), count: count ?? 0 });
  }
  return rows;
}

type SummaryRow = { id: string; label: string; basis: string; cutoff: string; count: number };

async function sendEmail(runId: string, summary: SummaryRow[], total: number) {
  if (!RESEND_API_KEY || NOTIFY_EMAILS.length === 0) {
    console.warn("[data-retention] RESEND_API_KEY mancante: email non inviata");
    return;
  }
  const link = `${SITE_URL}/admin/privacy?run=${runId}`;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("it-IT");
  const rowsHtml = summary.map((r) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${r.label}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right"><strong>${r.count}</strong></td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">prima del ${fmt(r.cutoff)}</td></tr>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="color:#1d724a">Pulizia dati: ${total} record oltre i termini di conservazione</h2>
      <p>La scansione mensile ha trovato dati che hanno superato i termini dichiarati nella Privacy Policy.
      <strong>Non è stato cancellato nulla</strong>: la cancellazione parte solo dopo la tua approvazione.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:6px 10px">Categoria</th><th style="padding:6px 10px">Record</th><th style="text-align:left;padding:6px 10px">Soglia</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin:24px 0"><a href="${link}" style="background:#1d724a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Rivedi e approva</a></p>
      <p style="font-size:12px;color:#6b7280">Puoi scegliere quali categorie cancellare o rifiutare la run. Finché non approvi, i dati restano dove sono. Riceverai un nuovo promemoria alla prossima scansione mensile.</p>
    </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "TechLand Italia <info@techlanditalia.it>",
      to: NOTIFY_EMAILS,
      subject: `[TECHLAND] Pulizia dati da approvare: ${total} record oltre i termini`,
      html,
    }),
  });
  if (!res.ok) console.error("[data-retention] Resend", res.status, await res.text());
}

async function notify(runId: string, summary: SummaryRow[]) {
  const total = summary.reduce((a, r) => a + r.count, 0);
  await Promise.all([
    notifyAdmins({
      title: "Pulizia dati da approvare",
      body: `${total} record oltre i termini di conservazione. Nulla viene cancellato senza il tuo ok.`,
      path: `/admin/privacy?run=${runId}`,
      type: "data_retention",
      tag: `data-retention-${runId}`,
    }),
    sendEmail(runId, summary, total),
  ]);
}

async function requireAdmin(db: Db, req: Request): Promise<{ userId: string } | Response> {
  const corsHeaders = corsHeadersFor(req);
  const deny = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return deny("Non autorizzato", 401);
  const { data: { user }, error } = await db.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) return deny("Non autorizzato", 401);
  const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return deny("Solo gli admin possono approvare la pulizia dei dati", 403);
  return { userId: user.id };
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, runId, categories, note } = parsed.data;

    const db: Db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (action === "scan") {
      const trigger = parsed.data.trigger ?? "manual";
      const summary = await buildSummary(db);
      const total = summary.reduce((a, r) => a + r.count, 0);

      const { data: pending } = await db
        .from("data_retention_runs")
        .select("id, notified_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (total === 0) {
        // Niente da fare: chiudiamo un'eventuale run pendente rimasta senza record
        if (pending) {
          await db.from("data_retention_runs").update({ status: "rejected", note: "Nessun record scaduto alla scansione successiva" }).eq("id", pending.id);
        }
        return json({ ok: true, total: 0, run: null });
      }

      let id: string;
      let shouldNotify = true;
      if (pending) {
        id = pending.id;
        await db.from("data_retention_runs").update({ summary, trigger }).eq("id", id);
        const last = pending.notified_at ? new Date(pending.notified_at).getTime() : 0;
        shouldNotify = Date.now() - last > RENOTIFY_AFTER_HOURS * 3600 * 1000;
      } else {
        const { data: created, error } = await db
          .from("data_retention_runs")
          .insert({ summary, trigger })
          .select("id")
          .single();
        if (error || !created) return json({ error: "Impossibile creare la run: " + error?.message }, 500);
        id = created.id;
      }

      if (shouldNotify) {
        await notify(id, summary);
        await db.from("data_retention_runs").update({ notified_at: new Date().toISOString() }).eq("id", id);
      }
      return json({ ok: true, total, run: { id, summary, notified: shouldNotify } });
    }

    // approve / reject: solo admin autenticato
    const admin = await requireAdmin(db, req);
    if (admin instanceof Response) return admin;
    if (!runId) return json({ error: "runId mancante" }, 400);

    const { data: run } = await db.from("data_retention_runs").select("id, status, summary").eq("id", runId).maybeSingle();
    if (!run) return json({ error: "Run non trovata" }, 404);
    if (run.status !== "pending") return json({ error: `Run già ${run.status}` }, 409);

    if (action === "reject") {
      await db.from("data_retention_runs").update({
        status: "rejected", approved_by: admin.userId, approved_at: new Date().toISOString(), note: note ?? null,
      }).eq("id", runId);
      return json({ ok: true });
    }

    // approve: cancella solo le categorie selezionate (default: tutte quelle della run)
    const selected = new Set(categories && categories.length > 0 ? categories : CATEGORIES.map((c) => c.id));
    const result: { id: string; deleted: number; error?: string }[] = [];
    for (const c of CATEGORIES) {
      if (!selected.has(c.id)) continue;
      const { data, error } = await scoped(db, c, "delete");
      if (error) {
        console.error(`[data-retention] delete ${c.id}`, error.message);
        result.push({ id: c.id, deleted: 0, error: error.message });
      } else {
        result.push({ id: c.id, deleted: Array.isArray(data) ? data.length : 0 });
      }
    }
    await db.from("data_retention_runs").update({
      status: "executed",
      approved_by: admin.userId,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      result,
      note: note ?? null,
    }).eq("id", runId);

    const deletedTotal = result.reduce((a, r) => a + r.deleted, 0);
    console.log(`[data-retention] run ${runId} approvata da ${admin.userId}: ${deletedTotal} record cancellati`);
    return json({ ok: true, result, deletedTotal });
  } catch (error) {
    console.error("[data-retention]", error);
    return json({ error: "Errore interno" }, 500);
  }
});

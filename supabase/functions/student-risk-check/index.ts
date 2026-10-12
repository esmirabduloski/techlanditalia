/**
 * Avviso "studente a rischio abbandono".
 *
 * Ogni mattina (job pg_cron student-risk-check-daily, header x-cron-token) legge
 * public.student_risk_signals() (drizzle/migrations/0028_student_risk_tasks.sql)
 * con le soglie di site_settings.student_risk_rules e, per ogni studente con
 * almeno un segnale, apre nel CRM un'attività "Chiama la famiglia" (crm_tasks)
 * sul lead del genitore. Se il lead non esiste lo crea dal profilo del
 * genitore (o dello studente, se non ha un genitore collegato).
 *
 * Una sola attività aperta per studente: se ce n'è già una viene aggiornata,
 * e i motivi nuovi finiscono nella timeline del lead. Un'attività chiusa da
 * meno di cooldown_days non viene riaperta per gli stessi motivi.
 *
 * Chiamata anche da un admin con 2FA ("Controlla ora" nel CRM), che riceve il
 * riepilogo in risposta.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";
import { parseRules, planTask, type RiskSignal, toStored } from "../_shared/studentrisk.ts";

const FN = "student-risk-check";
// Stesso crontab del job pg_cron student-risk-check-daily
const MONITOR = { slug: FN, schedule: "30 6 * * *", marginMinutes: 30, maxRuntimeMinutes: 10 };
const KIND = "student_at_risk";

type SignalRow = { student_id: string; student_name: string; parent_id: string | null; signals: RiskSignal[] };
type TaskRow = {
  id: string;
  lead_id: string;
  student_id: string;
  status: string;
  signals: RiskSignal[];
  completed_at: string | null;
  updated_at: string;
};
type LeadRow = { id: string; linked_profile_id: string | null; next_followup_at: string | null };
type ProfileRow = { id: string; full_name: string; email: string | null };

type Summary = {
  students: number;
  created: number;
  updated: number;
  unchanged: number;
  cooldown: number;
  leads_created: number;
  skipped: { student: string; reason: string }[];
};

/** Lead della famiglia: prima quello collegato al genitore, poi allo studente; altrimenti lo crea. */
async function resolveLead(
  supabase: SupabaseClient,
  row: SignalRow,
  leadsByProfile: Map<string, LeadRow>,
  profiles: Map<string, ProfileRow>,
  summary: Summary,
): Promise<LeadRow | string> {
  for (const pid of [row.parent_id, row.student_id]) {
    const lead = pid ? leadsByProfile.get(pid) : undefined;
    if (lead) return lead;
  }

  const contact = (row.parent_id && profiles.get(row.parent_id)) || profiles.get(row.student_id);
  const email = contact?.email?.trim().toLowerCase();
  if (!contact || !email) return "nessun lead e nessuna email per crearlo";

  // L'email è unica tra i lead: se ne esiste già uno lo si collega invece di duplicarlo
  const { data: existing } = await supabase
    .from("crm_leads").select("id, linked_profile_id, next_followup_at, deleted_at").eq("email", email).maybeSingle();
  if (existing?.deleted_at) return "il lead della famiglia è nel cestino";
  if (existing) {
    if (!existing.linked_profile_id) {
      await supabase.from("crm_leads").update({ linked_profile_id: contact.id }).eq("id", existing.id);
    }
    const lead = { ...existing, linked_profile_id: existing.linked_profile_id ?? contact.id };
    leadsByProfile.set(contact.id, lead);
    return lead;
  }

  const { data: created, error } = await supabase
    .from("crm_leads")
    .insert({
      email,
      full_name: contact.full_name,
      source: "registered",
      // È già una famiglia iscritta, non un contatto da convertire
      pipeline_stage: "won",
      linked_profile_id: contact.id,
      tags: ["Da richiamare"],
      notes: `Creato automaticamente dall'avviso studente a rischio (${row.student_name}).`,
    })
    .select("id, linked_profile_id, next_followup_at")
    .single();
  if (error || !created) return `creazione lead fallita: ${error?.message ?? "sconosciuto"}`;
  summary.leads_created++;
  leadsByProfile.set(contact.id, created);
  return created;
}

async function run(supabase: SupabaseClient, isCron: boolean): Promise<Summary & { disabled?: boolean }> {
  const summary: Summary = { students: 0, created: 0, updated: 0, unchanged: 0, cooldown: 0, leads_created: 0, skipped: [] };

  const { data: settings } = await supabase
    .from("site_settings").select("value").eq("key", "student_risk_rules").maybeSingle();
  const rules = parseRules(settings?.value);
  if (!rules.enabled) return { ...summary, disabled: true };

  const { data, error } = await supabase.rpc("student_risk_signals", { _rules: rules });
  if (error) throw new Error(`student_risk_signals: ${error.message}`);
  const rows = (data ?? []) as SignalRow[];
  summary.students = rows.length;
  if (rows.length === 0) return summary;

  const studentIds = rows.map((r) => r.student_id);
  const profileIds = [...new Set(rows.flatMap((r) => [r.student_id, r.parent_id].filter((x): x is string => !!x)))];

  const [{ data: tasks }, { data: leads }, { data: profileRows }] = await Promise.all([
    supabase.from("crm_tasks")
      .select("id, lead_id, student_id, status, signals, completed_at, updated_at")
      .eq("kind", KIND).in("student_id", studentIds)
      .order("updated_at", { ascending: false }),
    supabase.from("crm_leads")
      .select("id, linked_profile_id, next_followup_at")
      .in("linked_profile_id", profileIds).is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email").in("id", profileIds),
  ]);

  const openTasks = new Map<string, TaskRow>();
  const lastClosed = new Map<string, TaskRow>();
  for (const t of (tasks ?? []) as TaskRow[]) {
    if (t.status === "open") openTasks.set(t.student_id, t);
    else if (!lastClosed.has(t.student_id)) lastClosed.set(t.student_id, t);
  }
  const leadsByProfile = new Map<string, LeadRow>();
  for (const l of (leads ?? []) as LeadRow[]) {
    if (l.linked_profile_id && !leadsByProfile.has(l.linked_profile_id)) leadsByProfile.set(l.linked_profile_id, l);
  }
  const profiles = new Map(((profileRows ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  const now = new Date();
  const createdNames: string[] = [];

  for (const row of rows) {
    const open = openTasks.get(row.student_id) ?? null;
    const plan = planTask({
      signals: row.signals,
      open,
      lastClosed: lastClosed.get(row.student_id) ?? null,
      now,
      cooldownDays: rules.cooldown_days,
    });
    const stored = toStored(row.signals);
    const details = stored.map((s) => s.label).join(" · ");

    if (plan.action === "none") { summary.unchanged++; continue; }
    if (plan.action === "cooldown") { summary.cooldown++; continue; }

    if (plan.action === "update" && open) {
      await supabase.from("crm_tasks").update({ signals: stored, details }).eq("id", open.id);
      summary.updated++;
      if (plan.newReasons.length > 0) {
        await supabase.from("crm_interactions").insert({
          lead_id: open.lead_id,
          type: "note",
          subject: `Studente a rischio: nuovi motivi per ${row.student_name}`,
          content: toStored(plan.newReasons).map((s) => s.label).join("\n"),
          metadata: { task_id: open.id, student_id: row.student_id, automatic: true },
        });
      }
      continue;
    }

    const lead = await resolveLead(supabase, row, leadsByProfile, profiles, summary);
    if (typeof lead === "string") {
      summary.skipped.push({ student: row.student_name, reason: lead });
      continue;
    }

    const { data: task, error: taskError } = await supabase
      .from("crm_tasks")
      .insert({
        lead_id: lead.id,
        student_id: row.student_id,
        kind: KIND,
        title: `Chiama la famiglia di ${row.student_name}`,
        details,
        signals: stored,
        due_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (taskError || !task) {
      // 23505: un'altra esecuzione l'ha appena aperta, la prossima la aggiornerà
      if (taskError?.code !== "23505") {
        await captureServerError(taskError ?? new Error("Attività non creata"), {
          fn: FN, tags: { area: "crm" }, extra: { student_id: row.student_id },
        });
        summary.skipped.push({ student: row.student_name, reason: `creazione attività fallita: ${taskError?.message}` });
      }
      continue;
    }
    summary.created++;
    createdNames.push(row.student_name);

    await supabase.from("crm_interactions").insert({
      lead_id: lead.id,
      type: "note",
      subject: `Studente a rischio: chiamare la famiglia di ${row.student_name}`,
      content: stored.map((s) => s.label).join("\n"),
      metadata: { task_id: task.id, student_id: row.student_id, automatic: true },
    });
    // Il follow-up scaduto rende il lead evidente anche in Pipeline e Lista
    if (!lead.next_followup_at || new Date(lead.next_followup_at) > now) {
      await supabase.from("crm_leads").update({ next_followup_at: now.toISOString() }).eq("id", lead.id);
      lead.next_followup_at = now.toISOString();
    }
  }

  if (createdNames.length > 0 && isCron) {
    await notifyAdmins({
      title: createdNames.length === 1
        ? "📞 Uno studente a rischio abbandono"
        : `📞 ${createdNames.length} studenti a rischio abbandono`,
      body: `Da chiamare: ${createdNames.slice(0, 4).join(", ")}${createdNames.length > 4 ? ` e altri ${createdNames.length - 4}` : ""}`,
      path: "/admin/crm?tab=da-chiamare",
      type: "student_at_risk",
      tag: "student-risk",
    });
  }
  return summary;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let isCron = false;
  const cronToken = req.headers.get("x-cron-token") ?? "";
  if (cronToken) {
    const { data: ok } = await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken });
    isCron = ok === true;
  }
  if (!isCron) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = auth.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Non autorizzato" }, 401);
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Non autorizzato" }, 403);
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);
  }

  return withCronMonitor(isCron ? MONITOR : null, FN, async () => {
    try {
      const summary = await run(supabase, isCron);
      return json({ ok: true, ...summary });
    } catch (err) {
      await captureServerError(err, { fn: FN, tags: { area: "cron" } });
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
});

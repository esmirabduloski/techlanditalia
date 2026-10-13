/**
 * Sondaggio di soddisfazione (drizzle/migrations/0038_satisfaction_surveys.sql).
 *
 * Due azioni:
 *   - scan: ogni pomeriggio (job pg_cron satisfaction-survey-daily, header
 *     x-cron-token) o da un admin con 2FA. Crea i sondaggi dopo la terza
 *     lezione e a fine modulo e li manda alla famiglia con push ed email;
 *     chiude quelli rimasti senza risposta troppo a lungo.
 *   - respond: la famiglia (JWT del destinatario) manda voto e commento.
 *     Chi è soddisfatto riceve l'invito Trustpilot e il link referral, sulla
 *     pagina e via email; un voto basso apre l'attività "Chiama la famiglia"
 *     nel CRM e avvisa gli admin. Ogni risposta finisce nella timeline del lead.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError, withCronMonitor } from "../_shared/sentry.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { pausedStudentIds } from "../_shared/subscriptionpause.ts";
import {
  LOW_SATISFACTION_TASK_KIND,
  TRUSTPILOT_REVIEW_URL,
  cleanComment,
  isExpired,
  isValidScore,
  lowScoreLabel,
  parseRules,
  planSurvey,
  referralLink,
  scoreOutcome,
  surveyInviteMessage,
  surveyTopic,
  thankYouMessage,
  type SurveyKind,
  type SurveyRules,
} from "../_shared/satisfactionsurvey.ts";

const FN = "satisfaction-survey";
// Stesso crontab del job pg_cron satisfaction-survey-daily
const MONITOR = { slug: FN, schedule: "0 16 * * *", marginMinutes: 30, maxRuntimeMinutes: 10 };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

type DueRow = {
  student_id: string;
  group_id: string;
  kind: SurveyKind;
  module_number: number | null;
  module_title: string | null;
  lesson_date: string;
};
type Profile = { id: string; full_name: string; email: string | null; parent_id: string | null; referral_code: string | null };
type SurveyRow = {
  id: string;
  student_id: string;
  recipient_id: string;
  kind: SurveyKind;
  module_title: string | null;
  status: string;
};

type ScanSummary = {
  due: number;
  sent: number;
  skipped: number;
  expired: number;
  push_sent: number;
  emails_sent: number;
  problems: { student: string; reason: string }[];
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Link nel testo resi cliccabili (il testo è già escapato). */
const linkify = (s: string) =>
  s.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#059669;font-weight:bold;">${url}</a>`);

async function sendPush(supabase: SupabaseClient, userId: string, title: string, body: string, path: string): Promise<number> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !CONNECTION_KEY) return 0;

  const { data: devices } = await supabase.from("push_devices").select("id, token").eq("user_id", userId);
  let ok = 0;
  for (const device of devices ?? []) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": CONNECTION_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token: device.token, notification: { title, body }, data: { path } },
      }),
    });
    if (res.ok) {
      ok++;
    } else {
      const text = await res.text();
      console.error(`[${FN}] FCM ${res.status}: ${text}`);
      if (res.status === 404 || res.status === 400) {
        await supabase.from("push_devices").delete().eq("id", device.id as string);
      }
    }
  }
  return ok;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  paragraphs: string[];
  text: string;
  cta?: { label: string; url: string };
}): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn(`[${FN}] RESEND_API_KEY mancante, email non inviata`);
    return false;
  }
  const { to, subject, paragraphs, text, cta } = opts;
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = cta
    ? `<p style="margin:8px 0 20px;text-align:center;"><a href="${cta.url}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">${escapeHtml(cta.label)}</a></p>`
    : "";
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(subject)}</h1></td></tr>
  <tr><td style="padding:28px 24px;color:#1f2937;font-size:16px;line-height:1.6;">
  ${body}${button}
  <p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [to],
      reply_to: "info@techlanditalia.it",
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    await captureServerError(new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`), {
      fn: FN,
      fingerprint: [FN, "resend"],
    });
    return false;
  }
  return true;
}

async function loadRules(supabase: SupabaseClient): Promise<SurveyRules> {
  const { data } = await supabase
    .from("site_settings").select("value").eq("key", "satisfaction_survey_rules").maybeSingle();
  return parseRules(data?.value);
}

/** Lead della famiglia: prima quello collegato al genitore, poi allo studente. */
async function familyLeadId(supabase: SupabaseClient, student: Profile): Promise<string | null> {
  for (const pid of [student.parent_id, student.id]) {
    if (!pid) continue;
    const { data } = await supabase
      .from("crm_leads").select("id").eq("linked_profile_id", pid).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return data.id as string;
  }
  return null;
}

// ── scan ─────────────────────────────────────────────────────────────────────

async function scan(supabase: SupabaseClient): Promise<ScanSummary & { disabled?: boolean }> {
  const summary: ScanSummary = { due: 0, sent: 0, skipped: 0, expired: 0, push_sent: 0, emails_sent: 0, problems: [] };
  const rules = await loadRules(supabase);
  if (!rules.enabled) return { ...summary, disabled: true };
  const now = new Date();

  // 1. Sondaggi senza risposta da troppo tempo: spariscono dall'area riservata
  const { data: pending } = await supabase
    .from("satisfaction_surveys").select("id, sent_at").eq("status", "pending");
  const stale = ((pending ?? []) as { id: string; sent_at: string | null }[])
    .filter((s) => isExpired(s.sent_at, now, rules)).map((s) => s.id);
  if (stale.length) {
    await supabase.from("satisfaction_surveys").update({ status: "expired" }).in("id", stale).eq("status", "pending");
    summary.expired = stale.length;
  }

  // 2. Nuovi sondaggi
  const { data, error } = await supabase.rpc("satisfaction_survey_due", { _window_days: 7 });
  if (error) throw new Error(`satisfaction_survey_due: ${error.message}`);
  const due = (data ?? []) as DueRow[];
  summary.due = due.length;
  if (due.length === 0) return summary;

  const studentIds = [...new Set(due.map((d) => d.student_id))];
  const [{ data: existing }, { data: studentRows }, paused] = await Promise.all([
    supabase.from("satisfaction_surveys")
      .select("student_id, group_id, kind, module_number, sent_at")
      .in("student_id", studentIds),
    supabase.from("profiles").select("id, full_name, email, parent_id, referral_code").in("id", studentIds),
    pausedStudentIds(supabase, now),
  ]);
  const students = new Map(((studentRows ?? []) as Profile[]).map((p) => [p.id, p]));
  const parentIds = [...new Set([...students.values()].map((s) => s.parent_id).filter((x): x is string => !!x))];
  const { data: parentRows } = parentIds.length
    ? await supabase.from("profiles").select("id, full_name, email, parent_id, referral_code").in("id", parentIds)
    : { data: [] };
  const parents = new Map(((parentRows ?? []) as Profile[]).map((p) => [p.id, p]));

  type Existing = { student_id: string; group_id: string | null; kind: string; module_number: number | null; sent_at: string | null };
  const done = (existing ?? []) as Existing[];
  const lastSent = new Map<string, string>();
  for (const e of done) {
    if (e.sent_at && (!lastSent.has(e.student_id) || e.sent_at > lastSent.get(e.student_id)!)) {
      lastSent.set(e.student_id, e.sent_at);
    }
  }
  const already = (d: DueRow) => done.some((e) =>
    e.student_id === d.student_id && e.kind === d.kind &&
    (d.kind === "after_3_lessons" || (e.group_id === d.group_id && e.module_number === d.module_number))
  );

  // Prima i più vecchi: se nello stesso giorno ne scattano due, parte il primo
  due.sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || (a.kind === "after_3_lessons" ? -1 : 1));

  for (const d of due) {
    if (already(d)) continue;
    const student = students.get(d.student_id);
    if (!student) continue;
    const studentName = student.full_name || "lo studente";
    const parent = student.parent_id ? parents.get(student.parent_id) : undefined;
    const recipientId = parent?.id ?? student.id;
    const email = (parent?.email ?? student.email)?.trim();

    const plan = planSurvey({ paused: paused.has(d.student_id), lastSentAt: lastSent.get(d.student_id) ?? null, now, rules });
    const sending = plan.action === "send";

    // L'indice unico impedisce i doppioni se due esecuzioni si sovrappongono
    const { data: created, error: insErr } = await supabase
      .from("satisfaction_surveys")
      .insert({
        student_id: d.student_id,
        recipient_id: recipientId,
        group_id: d.group_id,
        kind: d.kind,
        module_number: d.kind === "module_end" ? d.module_number : null,
        module_title: d.kind === "module_end" ? d.module_title : null,
        status: sending ? "pending" : "skipped",
        skip_reason: plan.action === "skip" ? plan.reason : null,
        sent_at: sending ? now.toISOString() : null,
      })
      .select("id")
      .maybeSingle();
    if (insErr || !created) {
      if (insErr && insErr.code !== "23505") summary.problems.push({ student: studentName, reason: insErr.message });
      continue;
    }
    done.push({ student_id: d.student_id, group_id: d.group_id, kind: d.kind, module_number: d.module_number, sent_at: sending ? now.toISOString() : null });
    if (!sending) {
      summary.skipped++;
      continue;
    }
    lastSent.set(d.student_id, now.toISOString());

    const { title, body } = surveyInviteMessage({ studentName, kind: d.kind, moduleTitle: d.module_title });
    const path = `/area-riservata?sondaggio=${created.id}`;
    const pushed = await sendPush(supabase, recipientId, title, body, path);
    const mailed = email
      ? await sendEmail({
        to: email,
        subject: title,
        paragraphs: [body],
        text: `${body}\n\nRispondi qui: ${SITE_URL}${path}\n\nIl Team TECHLAND`,
        cta: { label: "Rispondi al sondaggio", url: `${SITE_URL}${path}` },
      })
      : false;
    summary.sent++;
    summary.push_sent += pushed;
    if (mailed) summary.emails_sent++;
    if (!pushed && !mailed) summary.problems.push({ student: studentName, reason: "nessuna push attiva e nessuna email" });
  }
  return summary;
}

// ── respond ──────────────────────────────────────────────────────────────────

async function lowScoreFollowUp(
  supabase: SupabaseClient,
  survey: SurveyRow,
  student: Profile,
  leadId: string | null,
  score: number,
  comment: string | null,
) {
  const studentName = student.full_name || "lo studente";
  // Il commento nel motivo: l'elenco "Da chiamare" mostra i motivi, non i dettagli
  const short = comment && comment.length > 80 ? `${comment.slice(0, 80)}…` : comment;
  const label = lowScoreLabel(score, survey.kind, survey.module_title) + (short ? ` — “${short}”` : "");
  const signal = { kind: "low_satisfaction", key: `low_satisfaction:${survey.id}`, label, score, survey_id: survey.id };

  if (leadId) {
    const { data: open } = await supabase
      .from("crm_tasks").select("id, signals, details")
      .eq("student_id", student.id).eq("kind", LOW_SATISFACTION_TASK_KIND).eq("status", "open")
      .maybeSingle();
    const details = comment ? `Commento: “${comment}”` : "Nessun commento.";
    if (open) {
      await supabase.from("crm_tasks").update({
        signals: [...((open.signals as unknown[]) ?? []), signal],
        details: [open.details, details].filter(Boolean).join("\n"),
      }).eq("id", open.id);
    } else {
      await supabase.from("crm_tasks").insert({
        lead_id: leadId,
        student_id: student.id,
        kind: LOW_SATISFACTION_TASK_KIND,
        title: `Chiama la famiglia di ${studentName}`,
        details,
        signals: [signal],
        due_at: new Date().toISOString(),
      });
    }
  }

  await notifyAdmins({
    title: `😟 ${score}/10 dalla famiglia di ${studentName}`,
    body: comment ? `“${comment.slice(0, 140)}”` : `Sondaggio su ${surveyTopic(survey.kind, survey.module_title)}, senza commento.`,
    path: "/admin/crm",
    type: "satisfaction_low",
    tag: `satisfaction-${survey.id}`,
  });
}

async function respond(
  supabase: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const surveyId = typeof body.survey_id === "string" ? body.survey_id : "";
  if (!surveyId) return { status: 400, body: { error: "Sondaggio mancante" } };
  if (!isValidScore(body.score)) return { status: 400, body: { error: "Il voto deve essere un numero da 0 a 10" } };
  const score = body.score;
  const comment = cleanComment(body.comment);

  const { data: surveyData } = await supabase
    .from("satisfaction_surveys")
    .select("id, student_id, recipient_id, kind, module_title, status")
    .eq("id", surveyId).maybeSingle();
  const survey = surveyData as SurveyRow | null;
  if (!survey || survey.recipient_id !== userId) return { status: 404, body: { error: "Sondaggio non trovato" } };
  if (survey.status !== "pending") return { status: 409, body: { error: "Hai già risposto a questo sondaggio, grazie!" } };

  const rules = await loadRules(supabase);
  const outcome = scoreOutcome(score, rules);

  // Solo il primo invio conta
  const { data: saved } = await supabase
    .from("satisfaction_surveys")
    .update({ status: "answered", score, comment, satisfied: outcome.satisfied, answered_at: new Date().toISOString() })
    .eq("id", survey.id).eq("status", "pending")
    .select("id");
  if (!saved || saved.length === 0) return { status: 409, body: { error: "Hai già risposto a questo sondaggio, grazie!" } };

  const [{ data: studentData }, { data: recipientData }, { data: rewardSetting }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, parent_id, referral_code").eq("id", survey.student_id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, parent_id, referral_code").eq("id", userId).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "referral_reward_text").maybeSingle(),
  ]);
  const student = studentData as Profile | null;
  const recipient = recipientData as Profile | null;
  const studentName = student?.full_name || "vostro figlio";

  const trustpilotUrl = outcome.trustpilot ? TRUSTPILOT_REVIEW_URL : null;
  // Il codice referral ce l'hanno i genitori
  const referral = outcome.referral ? referralLink(SITE_URL, recipient?.referral_code) : null;
  const rewardText = typeof rewardSetting?.value === "string" ? rewardSetting.value : null;

  try {
    if (student) {
      const leadId = await familyLeadId(supabase, student);
      if (leadId) {
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          type: "note",
          subject: `Sondaggio di soddisfazione: ${score}/10 (${surveyTopic(survey.kind, survey.module_title)})`,
          content: [`Studente: ${studentName}`, comment ? `Commento: “${comment}”` : "Nessun commento."].join("\n"),
          metadata: { survey_id: survey.id, student_id: student.id, score, automatic: true },
        });
      }
      if (outcome.followUp) await lowScoreFollowUp(supabase, survey, student, leadId, score, comment);
    }

    const email = recipient?.email?.trim();
    if (email && (trustpilotUrl || referral)) {
      const msg = thankYouMessage({ studentName, trustpilotUrl, referralLink: referral, rewardText });
      await sendEmail({
        to: email,
        subject: msg.subject,
        paragraphs: msg.paragraphs,
        text: msg.text,
        cta: trustpilotUrl ? { label: "Lascia una recensione su Trustpilot", url: trustpilotUrl } : undefined,
      });
    }
  } catch (err) {
    // La risposta è salvata: un problema con CRM o email non deve farla rifare
    await captureServerError(err, { fn: FN, tags: { area: "respond" } });
  }

  return {
    status: 200,
    body: {
      ok: true,
      satisfied: outcome.satisfied,
      follow_up: outcome.followUp,
      trustpilot_url: trustpilotUrl,
      referral_link: referral,
      referral_code: referral ? recipient?.referral_code ?? null : null,
    },
  };
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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* corpo vuoto */ }

  let isCron = false;
  const cronToken = req.headers.get("x-cron-token") ?? "";
  if (cronToken) {
    const { data: ok } = await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken });
    isCron = ok === true;
  }

  let userId: string | null = null;
  let isAdmin = false;
  let aal: string | undefined;
  if (!isCron) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
    const token = auth.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Non autorizzato" }, 401);
    userId = user.id;
    aal = decodeClaims(token).aal;
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    isAdmin = !!role;
  }

  if (body.action === "respond") {
    if (!userId) return json({ error: "Non autorizzato" }, 401);
    try {
      const res = await respond(supabase, userId, body);
      return json(res.body, res.status);
    } catch (err) {
      await captureServerError(err, { fn: FN, tags: { area: "respond" } });
      return json({ error: "Non siamo riusciti a salvare la risposta, riprova tra poco." }, 500);
    }
  }

  // scan: cron o admin con 2FA
  if (!isCron) {
    if (!isAdmin) return json({ error: "Non autorizzato" }, 403);
    if (aal !== "aal2") return mfaRequiredResponse(corsHeaders);
  }
  return withCronMonitor(isCron ? MONITOR : null, FN, async () => {
    try {
      const summary = await scan(supabase);
      return json({ ok: true, ...summary });
    } catch (err) {
      await captureServerError(err, { fn: FN, tags: { area: "cron" } });
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
});

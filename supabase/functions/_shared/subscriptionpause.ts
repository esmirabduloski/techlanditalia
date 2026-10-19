/**
 * Pausa dell'abbonamento (drizzle/migrations/0030_subscription_pauses.sql).
 *
 * Durante la pausa la famiglia non riceve push: le edge function che le mandano
 * usano pausedStudentIds / fullyPausedParents per saltare i destinatari. Le
 * uniche notifiche sono gli avvisi di fine pausa (14 e 7 giorni prima) del job
 * subscription-pause-check.
 */
import { brandedEmail, escapeHtml, type EmailContent } from "./emaillayout.ts";

export type PauseReason = "summer" | "exams" | "illness" | "other";

export const PAUSE_REASON_LABELS: Record<PauseReason, string> = {
  summer: "Estate",
  exams: "Esami",
  illness: "Malattia",
  other: "Altro",
};

/** Avvisi prima della ripresa, dal più lontano al più vicino. */
export const REMINDER_DAYS = [14, 7] as const;
export type ReminderDays = (typeof REMINDER_DAYS)[number];

/** Data di oggi (YYYY-MM-DD) in Italia. */
export function romeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
}

/** Giorni da a (YYYY-MM-DD) a b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Quale avviso mandare oggi. Se il job ha saltato dei giorni recupera, ma
 * manda solo l'avviso più vicino alla ripresa: chi è a 6 giorni riceve quello
 * dei 7 giorni, non anche quello dei 14.
 */
export function reminderDue(opts: {
  today: string;
  endsOn: string | null;
  sent14: boolean;
  sent7: boolean;
}): ReminderDays | null {
  const { today, endsOn, sent14, sent7 } = opts;
  if (!endsOn) return null;
  const left = daysBetween(today, endsOn);
  if (left <= 0) return null;
  if (left <= 7) return sent7 ? null : 7;
  if (left <= 14) return sent14 ? null : 14;
  return null;
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Testo dell'avviso di fine pausa per la famiglia (push ed email). */
export function pauseEndingMessage(opts: { studentName: string; endsOn: string; days: number }): {
  title: string;
  body: string;
} {
  const { studentName, endsOn, days } = opts;
  const when = days === 7 ? "tra una settimana" : days === 14 ? "tra due settimane" : `tra ${days} giorni`;
  return {
    title: `⏯️ La pausa di ${studentName} finisce ${when}`,
    body: `Dal ${formatDate(endsOn)} riprendono le lezioni di ${studentName} con TECHLAND. ` +
      "Se vi serve più tempo o volete cambiare orario, scriveteci.",
  };
}

/** Email dell'avviso di fine pausa, con il link all'area riservata. */
export function pauseEndingEmail(msg: { title: string; body: string }, siteUrl: string): EmailContent {
  return {
    subject: msg.title,
    html: brandedEmail({
      title: msg.title,
      bodyHtml: `<p style="margin:0 0 16px;">${escapeHtml(msg.body)}</p>
  <p style="margin:0 0 16px;"><a href="${siteUrl}/area-riservata" style="color:#059669;font-weight:bold;">Vai all'area riservata →</a></p>`,
    }),
    text: `${msg.body}\n\nIl Team TECHLAND`,
  };
}

// Client Supabase minimo: evita di importare supabase-js (questo file è testato con vitest)
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

/** Studenti in pausa oggi. */
export async function pausedStudentIds(supabase: Db, now: Date = new Date()): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("subscription_pauses")
    .select("student_id")
    .is("ended_at", null)
    .lte("starts_on", romeToday(now));
  if (error) throw new Error(`subscription_pauses: ${error.message}`);
  return new Set(((data ?? []) as { student_id: string }[]).map((r) => r.student_id));
}

/**
 * Account da non disturbare: gli studenti in pausa e i genitori con TUTTI i
 * figli in pausa (chi ha anche un figlio attivo continua a ricevere le push).
 */
export async function silencedProfileIds(supabase: Db, now: Date = new Date()): Promise<Set<string>> {
  const paused = await pausedStudentIds(supabase, now);
  if (paused.size === 0) return paused;

  const { data: pausedRows, error } = await supabase
    .from("profiles").select("parent_id").in("id", [...paused]);
  if (error) throw new Error(`profiles: ${error.message}`);
  const parentIds = [...new Set(((pausedRows ?? []) as { parent_id: string | null }[])
    .map((r) => r.parent_id).filter((x): x is string => !!x))];

  const silenced = new Set(paused);
  if (parentIds.length === 0) return silenced;

  const { data: children, error: childErr } = await supabase
    .from("profiles").select("id, parent_id").in("parent_id", parentIds);
  if (childErr) throw new Error(`profiles: ${childErr.message}`);
  const active = new Set(((children ?? []) as { id: string; parent_id: string }[])
    .filter((c) => !paused.has(c.id)).map((c) => c.parent_id));
  for (const p of parentIds) if (!active.has(p)) silenced.add(p);
  return silenced;
}

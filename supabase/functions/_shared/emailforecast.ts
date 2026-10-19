/**
 * Email previste nei prossimi giorni (scheda "Programmate" di /admin/email).
 *
 * I job non hanno una coda: ogni giorno decidono cosa mandare. Qui si simula
 * giorno per giorno la stessa regola dei job, sugli stessi dati:
 *   - send-payment-reminders (07:00 UTC): promemoria il giorno del promemoria
 *     della rata, solleciti dopo la scadenza secondo crm_payment_dunning;
 *   - subscription-pause-check (07:00 UTC): avvisi 14 e 7 giorni prima della ripresa;
 *   - school-closure-notice (07:00 UTC): avviso 3 giorni prima di una chiusura;
 *   - monthly-report e data-retention (il 1° del mese, 06:00 UTC).
 * Sondaggi, attestati, proposte e newsletter dipendono da eventi e non si prevedono.
 * Funzioni pure (testate con vitest): i dati li carica admin-email-center.
 */
import { EMAIL_KINDS, type EmailKind } from "./emailkinds.ts";
import { monthLabel, previousMonth } from "./monthlyreport.ts";
import {
  capitalize,
  CLIENT_MAX_DELAY_DAYS,
  euro,
  paymentPhrase,
  shortDate,
  type DunningSettings,
  type PaymentForText,
} from "./paymentreminders.ts";
import { daysBetween, reminderDue, romeToday } from "./subscriptionpause.ts";
import { closurePeriod, noticeDue, type ClosureForNotice } from "./closurenotice.ts";

/** push_email = arrivano entrambe; push = l'email parte solo se la push non riesce. */
export type EmailChannel = "email" | "push" | "push_email" | "none" | "paused";

export type UpcomingEmail = {
  kind: EmailKind;
  label: string;
  /** Istante previsto (ISO, UTC): l'ora del job pianificato. */
  scheduledFor: string;
  recipientName: string | null;
  recipientEmail: string | null;
  studentName: string | null;
  channel: EmailChannel;
  description: string;
};

/** Orari UTC dei job pg_cron (stessi crontab delle migrazioni). */
export const CRON_UTC = { payments: "07:00", pauses: "07:00", closures: "07:00", monthly: "06:00" } as const;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Primo giorno (data di Roma) in cui il job giornaliero delle `utcTime` deve ancora girare. */
export function nextRunDate(now: Date, utcTime: string): string {
  const today = romeToday(now);
  return now.getTime() < Date.parse(`${today}T${utcTime}:00Z`) ? today : addDays(today, 1);
}

const at = (date: string, utcTime: string) => `${date}T${utcTime}:00.000Z`;

const item = (kind: EmailKind, rest: Omit<UpcomingEmail, "kind" | "label">): UpcomingEmail =>
  ({ kind, label: EMAIL_KINDS[kind].label, ...rest });

// ── Pagamenti ────────────────────────────────────────────────────────────────

export type ForecastPayment = PaymentForText & {
  id: string;
  reminder_date: string | null;
  remind_client: boolean;
  client_reminder_sent_at: string | null;
  overdue_reminder_count: number;
  last_overdue_reminder_at: string | null;
  crm_leads: { full_name: string | null; email: string | null; linked_profile_id: string | null } | null;
};

/**
 * Canale del promemoria al cliente: push se ha l'app con le notifiche (e non è
 * in pausa), altrimenti email all'indirizzo del lead.
 */
function paymentChannel(p: ForecastPayment, pushUsers: Set<string>, silenced: Set<string>): EmailChannel {
  const linked = p.crm_leads?.linked_profile_id;
  if (linked && pushUsers.has(linked) && !silenced.has(linked)) return "push";
  return p.crm_leads?.email?.trim() ? "email" : "none";
}

export function forecastPayments(opts: {
  payments: ForecastPayment[];
  rules: DunningSettings;
  now: Date;
  days: number;
  /** Profili con almeno un dispositivo push. */
  pushUsers: Set<string>;
  /** Profili con l'abbonamento in pausa (niente push automatiche). */
  silenced: Set<string>;
}): UpcomingEmail[] {
  const { rules, now, pushUsers, silenced } = opts;
  const start = nextRunDate(now, CRON_UTC.payments);
  const end = addDays(romeToday(now), opts.days);
  const out: UpcomingEmail[] = [];

  for (const p of opts.payments) {
    const base = {
      recipientName: p.crm_leads?.full_name ?? null,
      recipientEmail: p.crm_leads?.email?.trim() || null,
      studentName: null,
      channel: paymentChannel(p, pushUsers, silenced),
    };

    // Promemoria prima della scadenza: al primo giro del job con reminder_date <= oggi
    if (p.remind_client && !p.client_reminder_sent_at && p.reminder_date) {
      const day = p.reminder_date > start ? p.reminder_date : start;
      const tooOld = daysBetween(p.reminder_date, day) > CLIENT_MAX_DELAY_DAYS;
      if (day <= end && !tooOld) {
        out.push(item("payment_reminder", {
          ...base,
          scheduledFor: at(day, CRON_UTC.payments),
          description: `${capitalize(paymentPhrase(p))} di ${euro(p.amount_cents)}` +
            (p.due_date ? ` in scadenza il ${shortDate(p.due_date)}` : ""),
        }));
      }
    }

    // Solleciti: stessa condizione di runDunning, ripetuta giorno per giorno
    if (!rules.enabled || rules.max_reminders <= 0 || !rules.notify_client || !p.remind_client || !p.due_date) continue;
    const firstAfter = Math.max(0, rules.first_after_days);
    const repeatEvery = Math.max(1, rules.repeat_every_days);
    let count = p.overdue_reminder_count;
    let last = p.last_overdue_reminder_at ? romeToday(new Date(p.last_overdue_reminder_at)) : null;
    for (let day = start; day <= end && count < rules.max_reminders; day = addDays(day, 1)) {
      if (p.due_date > addDays(day, -firstAfter)) continue;
      if (last && daysBetween(last, day) < repeatEvery) continue;
      count++;
      last = day;
      out.push(item("payment_overdue", {
        ...base,
        scheduledFor: at(day, CRON_UTC.payments),
        description: `Sollecito ${count}/${rules.max_reminders}: ${paymentPhrase(p)} di ${euro(p.amount_cents)}, ` +
          `scaduta il ${shortDate(p.due_date)}`,
      }));
    }
  }
  return out;
}

// ── Fine pausa ───────────────────────────────────────────────────────────────

export type ForecastPause = {
  ends_on: string | null;
  reminder_14_sent_at: string | null;
  reminder_7_sent_at: string | null;
  studentName: string;
  /** Il genitore, o lo studente senza genitore. */
  recipientId: string;
  recipientName: string | null;
  recipientEmail: string | null;
};

const formatDate = (iso: string) => iso.split("-").reverse().join("/");

export function forecastPauses(opts: {
  pauses: ForecastPause[];
  now: Date;
  days: number;
  pushUsers: Set<string>;
}): UpcomingEmail[] {
  const start = nextRunDate(opts.now, CRON_UTC.pauses);
  const end = addDays(romeToday(opts.now), opts.days);
  const out: UpcomingEmail[] = [];

  for (const p of opts.pauses) {
    if (!p.ends_on) continue;
    const hasPush = opts.pushUsers.has(p.recipientId);
    const hasEmail = !!p.recipientEmail?.trim();
    const channel: EmailChannel = hasPush && hasEmail ? "push_email" : hasPush ? "push" : hasEmail ? "email" : "none";
    let sent14 = !!p.reminder_14_sent_at;
    let sent7 = !!p.reminder_7_sent_at;
    for (let day = start; day <= end && day < p.ends_on; day = addDays(day, 1)) {
      const due = reminderDue({ today: day, endsOn: p.ends_on, sent14, sent7 });
      if (!due) continue;
      if (due === 14) sent14 = true;
      else sent7 = true;
      out.push(item("pause_ending", {
        scheduledFor: at(day, CRON_UTC.pauses),
        recipientName: p.recipientName,
        recipientEmail: p.recipientEmail?.trim() || null,
        studentName: p.studentName,
        channel,
        description: `Le lezioni riprendono il ${formatDate(p.ends_on)} (avviso a ${due} giorni)`,
      }));
    }
  }
  return out;
}

// ── Chiusure e festività ─────────────────────────────────────────────────────

export type ForecastClosure = ClosureForNotice & {
  notified_at: string | null;
  /** Famiglie da avvisare (school_closure_audience), già senza gli studenti in pausa. */
  recipients: { recipientId: string; recipientName: string | null; recipientEmail: string | null; studentNames: string[] }[];
};

export function forecastClosures(opts: {
  closures: ForecastClosure[];
  now: Date;
  days: number;
  pushUsers: Set<string>;
}): UpcomingEmail[] {
  const start = nextRunDate(opts.now, CRON_UTC.closures);
  const end = addDays(romeToday(opts.now), opts.days);
  const out: UpcomingEmail[] = [];

  for (const c of opts.closures) {
    let day: string | null = null;
    for (let d = start; d <= end && d <= c.start_date; d = addDays(d, 1)) {
      if (noticeDue({ today: d, startDate: c.start_date, notifiedAt: c.notified_at })) {
        day = d;
        break;
      }
    }
    if (!day) continue;
    for (const r of c.recipients) {
      const hasPush = opts.pushUsers.has(r.recipientId);
      const hasEmail = !!r.recipientEmail?.trim();
      out.push(item("closure_notice", {
        scheduledFor: at(day, CRON_UTC.closures),
        recipientName: r.recipientName,
        recipientEmail: r.recipientEmail?.trim() || null,
        studentName: r.studentNames.join(", ") || null,
        channel: hasPush && hasEmail ? "push_email" : hasPush ? "push" : hasEmail ? "email" : "none",
        description: `${c.title}: niente lezioni ${closurePeriod(c.start_date, c.end_date)}`,
      }));
    }
  }
  return out;
}

// ── Job mensili ──────────────────────────────────────────────────────────────

/** Primi del mese (YYYY-MM-01) i cui job delle `utcTime` cadono tra adesso e la fine della finestra. */
function monthFirsts(now: Date, days: number, utcTime: string): string[] {
  const end = addDays(romeToday(now), days);
  const out: string[] = [];
  let month = romeToday(now).slice(0, 7);
  for (;;) {
    const first = `${month}-01`;
    if (first > end) break;
    if (Date.parse(at(first, utcTime)) > now.getTime()) out.push(first);
    const [y, m] = month.split("-").map(Number);
    month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return out;
}

export function forecastMonthlyReport(opts: {
  now: Date;
  days: number;
  admins: { name: string | null; email: string }[];
  /** Mesi (YYYY-MM) il cui report risulta già inviato in monthly_reports. */
  sentMonths: Set<string>;
}): UpcomingEmail[] {
  return monthFirsts(opts.now, opts.days, CRON_UTC.monthly).flatMap((first) => {
    const month = previousMonth(first.slice(0, 7));
    if (opts.sentMonths.has(month)) return [];
    return opts.admins.map((a) => item("staff_monthly_report", {
      scheduledFor: at(first, CRON_UTC.monthly),
      recipientName: a.name,
      recipientEmail: a.email,
      studentName: null,
      channel: "email",
      description: `Report di ${monthLabel(month)}`,
    }));
  });
}

export function forecastDataRetention(opts: { now: Date; days: number; recipients: string[] }): UpcomingEmail[] {
  if (opts.recipients.length === 0) return [];
  return monthFirsts(opts.now, opts.days, CRON_UTC.monthly).map((first) => item("staff_data_retention", {
    scheduledFor: at(first, CRON_UTC.monthly),
    recipientName: null,
    recipientEmail: opts.recipients.join(", "),
    studentName: null,
    channel: "email",
    description: "Solo se la scansione mensile trova dati oltre i termini di conservazione",
  }));
}

export function sortUpcoming(items: UpcomingEmail[]): UpcomingEmail[] {
  return [...items].sort((a, b) =>
    a.scheduledFor.localeCompare(b.scheduledFor) || a.kind.localeCompare(b.kind) ||
    (a.recipientName ?? "").localeCompare(b.recipientName ?? ""));
}

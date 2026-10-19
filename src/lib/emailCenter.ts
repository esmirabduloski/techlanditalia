/**
 * Centro di controllo Email (/admin/email): contratto con il registro
 * public.email_log (drizzle/migrations/0057_email_log.sql) e con la edge
 * function admin-email-center, più gli helper puri della pagina.
 * I tipi di email e le loro regole stanno in supabase/functions/_shared/emailkinds.ts.
 */

export type EmailStatus = 'sent' | 'failed';

/** Riga di public.email_log; html è null per le email con link o codici d'accesso. */
export type EmailLogRow = {
  id: string;
  kind: string;
  to_email: string;
  recipient_id: string | null;
  lead_id: string | null;
  subject: string;
  html: string | null;
  status: EmailStatus;
  error: string | null;
  provider_id: string | null;
  source: string;
  created_at: string;
};

export type EmailAudience = 'famiglia' | 'staff' | 'iscritti' | 'esterno';
export type EmailCategory = 'automatica' | 'evento' | 'manuale';

/** push = l'email parte solo se la push non arriva; push_email = arrivano entrambe. */
export type EmailChannel = 'email' | 'push' | 'push_email' | 'none' | 'paused';

export type CatalogEntry = {
  kind: string;
  label: string;
  audience: EmailAudience;
  category: EmailCategory;
  trigger: string;
  schedule: string | null;
  source: string;
  /** Corpo non salvato nel registro (link o codici d'accesso). */
  sensitive: boolean;
  sample: { subject: string; html: string; text?: string };
  sent30d: number;
  failed30d: number;
};

export type CatalogResponse = { entries: CatalogEntry[]; logReady: boolean };

export type UpcomingEmail = {
  kind: string;
  label: string;
  /** Istante previsto, ISO in UTC. */
  scheduledFor: string;
  recipientName: string | null;
  recipientEmail: string | null;
  studentName: string | null;
  channel: EmailChannel;
  description: string;
};

export type UpcomingResponse = { items: UpcomingEmail[]; days: number };

export type TestResponse = { ok: boolean; to?: string; error?: string };

export const PAGE_SIZE = 50;
export const UPCOMING_WINDOWS = [30, 60, 90] as const;
export const SENT_PERIODS = [7, 30, 90, 365] as const;

export const AUDIENCE_LABELS: Record<EmailAudience, string> = {
  famiglia: 'Famiglie',
  staff: 'Staff',
  iscritti: 'Iscritti newsletter',
  esterno: 'Servizio esterno',
};

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  automatica: 'Automatica',
  evento: 'A evento',
  manuale: "Inviata dall'admin",
};

export const CHANNEL_LABELS: Record<EmailChannel, string> = {
  email: 'Email',
  push: 'Push (email se non arriva)',
  push_email: 'Push + email',
  none: 'Nessun canale',
  paused: 'In pausa',
};

export const STATUS_LABELS: Record<EmailStatus, string> = { sent: 'Inviata', failed: 'Non inviata' };

const TZ = 'Europe/Rome';

/** "19/10/26, 09:00" nell'ora di Roma. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
}

/** "09:00" nell'ora di Roma. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/** Giorno (YYYY-MM-DD) nell'ora di Roma. */
export function romeDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
}

/** "lunedì 26 ottobre 2026" */
export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Email previste raggruppate per giorno di Roma, nell'ordine in cui arrivano. */
export function groupByDay(items: UpcomingEmail[]): { day: string; label: string; items: UpcomingEmail[] }[] {
  const groups = new Map<string, UpcomingEmail[]>();
  for (const item of [...items].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))) {
    const day = romeDay(item.scheduledFor);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups].map(([day, list]) => ({ day, label: dayLabel(day), items: list }));
}

/** Inizio del periodo "ultimi N giorni" (ISO). */
export function sinceIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Testo cercato senza i caratteri che cambiano il senso dei filtri PostgREST. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Totali degli ultimi 30 giorni dal catalogo (le email di prova non contano). */
export function catalogTotals(entries: CatalogEntry[]): { sent: number; failed: number } {
  return entries.reduce((t, e) => ({ sent: t.sent + e.sent30d, failed: t.failed + e.failed30d }), { sent: 0, failed: 0 });
}

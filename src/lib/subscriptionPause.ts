/**
 * Pausa dell'abbonamento (drizzle/migrations/0030_subscription_pauses.sql).
 * Durante la pausa le lezioni non vengono scalate e la famiglia non riceve
 * push; il job subscription-pause-check la chiude alla data di ripresa.
 */
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export type PauseReason = 'summer' | 'exams' | 'illness' | 'other';

// Stesse etichette di supabase/functions/_shared/subscriptionpause.ts
export const PAUSE_REASON_LABELS: Record<PauseReason, string> = {
  summer: 'Estate',
  exams: 'Esami',
  illness: 'Malattia',
  other: 'Altro',
};

export type SubscriptionPause = {
  id: string;
  student_id: string;
  reason: PauseReason;
  notes: string | null;
  starts_on: string;
  ends_on: string | null;
  ended_at: string | null;
  created_at: string;
};

export type SubscriptionPauseWithStudent = SubscriptionPause & {
  student: { id: string; full_name: string; parent_id: string | null } | null;
};

/** Data di oggi (YYYY-MM-DD) in Italia, come is_student_paused() nel database. */
export function romeTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now);
}

/** Pausa in corso oggi (una pausa programmata per il futuro non lo è ancora). */
export function isPauseActive(p: Pick<SubscriptionPause, 'starts_on' | 'ended_at'>, today = romeTodayIso()): boolean {
  return !p.ended_at && p.starts_on <= today;
}

export function shortDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: it });
}

/** "fino al 08/09/2026", "dal 01/07/2026 al 08/09/2026", "a tempo indeterminato". */
export function pausePeriodLabel(p: Pick<SubscriptionPause, 'starts_on' | 'ends_on'>, today = romeTodayIso()): string {
  if (p.starts_on > today) {
    return p.ends_on ? `dal ${shortDate(p.starts_on)} al ${shortDate(p.ends_on)}` : `dal ${shortDate(p.starts_on)}`;
  }
  return p.ends_on ? `fino al ${shortDate(p.ends_on)}` : 'senza data di ripresa';
}

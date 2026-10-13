/**
 * Questionario di disdetta (drizzle/migrations/0031_subscription_cancellations.sql):
 * tre domande che l'admin pone alla famiglia quando disdice.
 */

export type CancellationReason =
  | 'cost'
  | 'schedule'
  | 'lost_interest'
  | 'little_progress'
  | 'too_busy'
  | 'moving'
  | 'teacher_group'
  | 'other';

export type WouldReturn = 'yes' | 'maybe' | 'no';

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  cost: 'Costo',
  schedule: 'Orari / giorni delle lezioni',
  lost_interest: 'Il figlio non è più interessato',
  little_progress: 'Pochi progressi',
  too_busy: 'Troppi impegni (scuola, sport)',
  moving: 'Trasloco',
  teacher_group: 'Insegnante o gruppo',
  other: 'Altro',
};

export const WOULD_RETURN_LABELS: Record<WouldReturn, string> = {
  yes: 'Sì',
  maybe: 'Forse',
  no: 'No',
};

export type SubscriptionCancellation = {
  id: string;
  lead_id: string;
  student_id: string | null;
  reason: CancellationReason;
  reason_other: string | null;
  would_have_stayed: string | null;
  would_return: WouldReturn;
  cancelled_on: string;
  created_at: string;
};

/** Motivo da mostrare: per "Altro" il testo scritto dall'admin. */
export function reasonText(c: Pick<SubscriptionCancellation, 'reason' | 'reason_other'>): string {
  return c.reason === 'other' && c.reason_other?.trim()
    ? `Altro: ${c.reason_other.trim()}`
    : CANCELLATION_REASON_LABELS[c.reason];
}

/** Riepilogo per le Analytics: disdette per motivo (dal più frequente) e "tornerebbero?". */
export function summarizeCancellations(rows: Pick<SubscriptionCancellation, 'reason' | 'would_return'>[]) {
  const byReason = new Map<CancellationReason, number>();
  const byReturn: Record<WouldReturn, number> = { yes: 0, maybe: 0, no: 0 };
  for (const r of rows) {
    byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
    byReturn[r.would_return]++;
  }
  const reasons = [...byReason.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || CANCELLATION_REASON_LABELS[a.reason].localeCompare(CANCELLATION_REASON_LABELS[b.reason]));
  return { total: rows.length, reasons, byReturn };
}

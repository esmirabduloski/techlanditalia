/**
 * Proposta del corso successivo (drizzle/migrations/0036_course_proposals.sql).
 * Le regole sullo sconto sono le stesse della edge function course-proposal.
 */
import type { Tables } from '@/integrations/supabase/types';

export type CourseProposal = Tables<'course_proposals'>;
export type CourseProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn';

/** Sconto proposto all'admin per chi continua subito. */
export const DEFAULT_DISCOUNT_CENTS = 5000;

// Stesse regole di supabase/functions/_shared/courseproposal.ts
export const DEFAULT_OFFER_DAYS = 10;

/** 5000 → "50 €", 2550 → "25,50 €". */
export function formatEuro(cents: number): string {
  const euros = cents / 100;
  const text = Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} €`;
}

/** Lo sconto vale se c'è e la famiglia risponde entro la scadenza (inclusa). */
export function discountStillValid(opts: { today: string; expiresOn: string | null; discountCents: number }): boolean {
  if (opts.discountCents <= 0 || !opts.expiresOn) return false;
  return opts.today <= opts.expiresOn;
}

export const PROPOSAL_STATUS_LABELS: Record<CourseProposalStatus, string> = {
  draft: 'Da inviare',
  sent: 'Inviata, in attesa',
  accepted: 'Confermata',
  declined: 'Vogliono parlarne',
  withdrawn: 'Ritirata',
};

/** Data di oggi (YYYY-MM-DD) in Italia. */
export function romeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now);
}

/** Oggi + n giorni (YYYY-MM-DD). */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → "gg/mm/aaaa". */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** "50" o "25,5" → centesimi; null se non è un importo valido. */
export function parseEuroInput(value: string): number | null {
  const n = Number(value.replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return Math.round(n * 100);
}

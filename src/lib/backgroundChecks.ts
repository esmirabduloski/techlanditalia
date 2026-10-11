import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Promemoria del certificato del casellario giudiziale degli insegnanti
 * (art. 25-bis DPR 313/2002). Solo date: il certificato resta fuori dall'app.
 */
export interface BackgroundCheck {
  user_id: string;
  verified_at: string;
  next_check_at: string;
}

export type BackgroundCheckStatus = 'missing' | 'expired' | 'expiring' | 'ok';

/** Giorni di preavviso prima del prossimo controllo. */
export const EXPIRING_DAYS = 30;
/** Intervallo di rinnovo proposto (buona prassi, la legge non lo fissa). */
export const DEFAULT_RENEWAL_MONTHS = 12;

export function backgroundCheckStatus(check: BackgroundCheck | undefined, today: Date = new Date()): BackgroundCheckStatus {
  if (!check) return 'missing';
  const daysLeft = differenceInCalendarDays(parseISO(check.next_check_at), today);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= EXPIRING_DAYS) return 'expiring';
  return 'ok';
}

export function defaultNextCheck(verifiedAt: string): string {
  return format(addMonths(parseISO(verifiedAt), DEFAULT_RENEWAL_MONTHS), 'yyyy-MM-dd');
}

export function formatItDate(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM/yyyy');
}

export async function fetchBackgroundChecks(): Promise<Map<string, BackgroundCheck>> {
  const { data, error } = await supabase
    .from('teacher_background_checks' as never)
    .select('user_id, verified_at, next_check_at');
  const map = new Map<string, BackgroundCheck>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as BackgroundCheck[]) map.set(row.user_id, row);
  return map;
}

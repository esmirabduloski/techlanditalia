/**
 * Avviso "studente a rischio abbandono": tipi e soglie lato CRM.
 * I segnali e i loro testi sono preparati dalla edge function student-risk-check
 * (supabase/functions/_shared/studentrisk.ts) e salvati in crm_tasks.signals.
 */

export const STUDENT_RISK_RULES_KEY = 'student_risk_rules';
export const STUDENT_RISK_TASK_KIND = 'student_at_risk';

export type StudentRiskRules = {
  enabled: boolean;
  absences_in_a_row: number;
  homework_missing_min: number;
  homework_window_days: number;
  streak_window_days: number;
  /** null = segnale disattivato */
  low_balance_threshold: number | null;
  cooldown_days: number;
};

// Stessi valori di DEFAULT_RULES in supabase/functions/_shared/studentrisk.ts
export const DEFAULT_STUDENT_RISK_RULES: StudentRiskRules = {
  enabled: true,
  absences_in_a_row: 2,
  homework_missing_min: 1,
  homework_window_days: 14,
  streak_window_days: 14,
  low_balance_threshold: 2,
  cooldown_days: 14,
};

export type RiskSignalKind = 'consecutive_absences' | 'missing_homework' | 'streak_broken' | 'low_balance';

export type StoredRiskSignal = { kind: RiskSignalKind; key: string; label: string } & Record<string, unknown>;

export type CrmTaskStatus = 'open' | 'done' | 'dismissed';

export type CrmTask = {
  id: string;
  lead_id: string;
  student_id: string | null;
  kind: string;
  title: string;
  details: string | null;
  signals: StoredRiskSignal[];
  status: CrmTaskStatus;
  due_at: string;
  completed_at: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTaskWithRefs = CrmTask & {
  crm_leads: { full_name: string | null; email: string | null; phone: string | null } | null;
  student: { full_name: string | null } | null;
};

/** Link tel: con solo cifre e +, null se il numero non è utilizzabile. */
export function telLink(phone: string | null | undefined): string | null {
  const clean = (phone ?? '').replace(/[^\d+]/g, '');
  return clean.replace(/\+/g, '').length >= 6 ? `tel:${clean}` : null;
}

/** Da quanti giorni l'attività è aperta (0 = oggi). */
export function daysOpen(createdAt: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000));
}

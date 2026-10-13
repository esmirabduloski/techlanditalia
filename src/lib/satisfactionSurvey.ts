/**
 * Sondaggio di soddisfazione: tipi e riepilogo lato app.
 * Invio, risposta e inviti li gestisce la edge function satisfaction-survey
 * (supabase/functions/_shared/satisfactionsurvey.ts).
 */

export type SurveyKind = 'after_3_lessons' | 'module_end';
export type SurveyStatus = 'pending' | 'answered' | 'skipped' | 'expired';

export type SatisfactionSurvey = {
  id: string;
  student_id: string;
  recipient_id: string;
  group_id: string | null;
  kind: SurveyKind;
  module_number: number | null;
  module_title: string | null;
  status: SurveyStatus;
  skip_reason: string | null;
  score: number | null;
  comment: string | null;
  satisfied: boolean | null;
  sent_at: string | null;
  answered_at: string | null;
  created_at: string;
};

/** Risposta della edge function all'azione respond. */
export type SurveyResult = {
  satisfied: boolean;
  follow_up: boolean;
  trustpilot_url: string | null;
  referral_link: string | null;
  referral_code: string | null;
};

export const SURVEY_KIND_LABELS: Record<SurveyKind, string> = {
  after_3_lessons: 'Dopo 3 lezioni',
  module_end: 'Fine modulo',
};

/** Domanda principale, con il nome dello studente. */
export function surveyQuestion(s: Pick<SatisfactionSurvey, 'kind' | 'module_title'>, studentName: string): string {
  return s.kind === 'after_3_lessons'
    ? `Come sono andate le prime lezioni di ${studentName}?`
    : `${studentName} ha finito ${s.module_title ? `il modulo «${s.module_title}»` : 'un modulo'}: com'è andata?`;
}

/** Fascia NPS del voto: promotori 9-10, passivi 7-8, detrattori 0-6. */
export function npsBand(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

export type SurveySummary = {
  sent: number;
  answered: number;
  /** Risposte su inviati, 0-100 */
  responseRate: number;
  average: number | null;
  /** -100..100, null senza risposte */
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  byKind: Record<SurveyKind, { answered: number; average: number | null }>;
};

export function summarizeSurveys(rows: Pick<SatisfactionSurvey, 'kind' | 'status' | 'score'>[]): SurveySummary {
  const sent = rows.filter((r) => r.status === 'pending' || r.status === 'answered' || r.status === 'expired');
  const answered = rows.filter((r): r is typeof r & { score: number } => r.status === 'answered' && r.score !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const bands = { promoter: 0, passive: 0, detractor: 0 };
  for (const r of answered) bands[npsBand(r.score)]++;
  const byKind = (kind: SurveyKind) => {
    const scores = answered.filter((r) => r.kind === kind).map((r) => r.score);
    return { answered: scores.length, average: avg(scores) };
  };
  return {
    sent: sent.length,
    answered: answered.length,
    responseRate: sent.length ? Math.round((answered.length / sent.length) * 100) : 0,
    average: avg(answered.map((r) => r.score)),
    nps: answered.length ? Math.round(((bands.promoter - bands.detractor) / answered.length) * 100) : null,
    promoters: bands.promoter,
    passives: bands.passive,
    detractors: bands.detractor,
    byKind: { after_3_lessons: byKind('after_3_lessons'), module_end: byKind('module_end') },
  };
}

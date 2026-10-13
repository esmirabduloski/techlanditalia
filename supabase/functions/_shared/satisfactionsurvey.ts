/**
 * Logica pura del sondaggio di soddisfazione (satisfaction-survey).
 * I momenti in cui parte arrivano da public.satisfaction_survey_due()
 * (drizzle/migrations/0038_satisfaction_surveys.sql); qui si decide se mandarlo,
 * cosa fare con la risposta e si preparano i testi in italiano.
 */

export type SurveyKind = "after_3_lessons" | "module_end";

export type SurveyRules = {
  enabled: boolean;
  /** Da questo voto in su: link referral */
  satisfied_min: number;
  /** Da questo voto in su: invito Trustpilot */
  trustpilot_min: number;
  /** Fino a questo voto: attività "Chiama la famiglia" nel CRM */
  low_max: number;
  /** Nessun nuovo sondaggio per lo stesso studente prima di N giorni */
  cooldown_days: number;
  /** Un sondaggio senza risposta sparisce dopo N giorni */
  expire_days: number;
};

// Stessi valori di site_settings.satisfaction_survey_rules in 0038_satisfaction_surveys.sql
export const DEFAULT_RULES: SurveyRules = {
  enabled: true,
  satisfied_min: 9,
  trustpilot_min: 9,
  low_max: 6,
  cooldown_days: 14,
  expire_days: 21,
};

export const TRUSTPILOT_REVIEW_URL = "https://it.trustpilot.com/evaluate/techlanditalia.it";
export const LOW_SATISFACTION_TASK_KIND = "low_satisfaction";

export function parseRules(value: unknown): SurveyRules {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const int = (k: keyof SurveyRules, min: number, max: number) => {
    const n = Number(v[k]);
    return Number.isFinite(n) && v[k] !== null && v[k] !== ""
      ? Math.min(Math.max(Math.round(n), min), max)
      : DEFAULT_RULES[k] as number;
  };
  return {
    enabled: v.enabled === undefined ? DEFAULT_RULES.enabled : v.enabled === true,
    satisfied_min: int("satisfied_min", 0, 10),
    trustpilot_min: int("trustpilot_min", 0, 10),
    low_max: int("low_max", -1, 10),
    cooldown_days: int("cooldown_days", 0, 365),
    expire_days: int("expire_days", 1, 365),
  };
}

const DAY = 86_400_000;

/**
 * Mandare il sondaggio o saltarlo. Saltato resta registrato (status 'skipped')
 * così lo stesso momento non viene riproposto.
 */
export function planSurvey(opts: {
  paused: boolean;
  /** Ultimo sondaggio inviato per lo stesso studente */
  lastSentAt: string | null;
  now: Date;
  rules: SurveyRules;
}): { action: "send" } | { action: "skip"; reason: string } {
  const { paused, lastSentAt, now, rules } = opts;
  if (paused) return { action: "skip", reason: "studente in pausa" };
  if (lastSentAt && now.getTime() - Date.parse(lastSentAt) < rules.cooldown_days * DAY) {
    return { action: "skip", reason: `sondaggio già inviato negli ultimi ${rules.cooldown_days} giorni` };
  }
  return { action: "send" };
}

export function isExpired(sentAt: string | null, now: Date, rules: SurveyRules): boolean {
  return !!sentAt && now.getTime() - Date.parse(sentAt) >= rules.expire_days * DAY;
}

export type ScoreOutcome = {
  satisfied: boolean;
  trustpilot: boolean;
  referral: boolean;
  followUp: boolean;
};

export function scoreOutcome(score: number, rules: SurveyRules): ScoreOutcome {
  const satisfied = score >= rules.satisfied_min;
  return {
    satisfied,
    trustpilot: score >= rules.trustpilot_min,
    referral: satisfied,
    followUp: score <= rules.low_max,
  };
}

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
}

/** Commento della famiglia: testo semplice, al massimo 2000 caratteri. */
export function cleanComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, 2000);
  return text || null;
}

export function referralLink(siteUrl: string, code: string | null | undefined): string | null {
  return code ? `${siteUrl.replace(/\/$/, "")}/prenota?ref=${encodeURIComponent(code)}` : null;
}

/** Di cosa parla il sondaggio, per i testi: "le prime lezioni" / "il modulo «X»". */
export function surveyTopic(kind: SurveyKind, moduleTitle: string | null): string {
  if (kind === "after_3_lessons") return "le prime lezioni";
  return moduleTitle ? `il modulo «${moduleTitle}»` : "l'ultimo modulo";
}

/** Push ed email di invito al sondaggio. */
export function surveyInviteMessage(opts: {
  studentName: string;
  kind: SurveyKind;
  moduleTitle: string | null;
}): { title: string; body: string } {
  const { studentName, kind, moduleTitle } = opts;
  if (kind === "after_3_lessons") {
    return {
      title: `Come stanno andando le lezioni di ${studentName}?`,
      body: `${studentName} ha fatto le prime tre lezioni con TECHLAND. ` +
        "Ci dite com'è andata? Sono due domande, meno di un minuto.",
    };
  }
  return {
    title: `${studentName} ha finito un modulo! Com'è andata?`,
    body: `${studentName} ha appena concluso ${surveyTopic(kind, moduleTitle)}. ` +
      "Ci dite com'è andata? Sono due domande, meno di un minuto.",
  };
}

/** Email di ringraziamento a chi è soddisfatto: invito Trustpilot e/o link referral. */
export function thankYouMessage(opts: {
  studentName: string;
  trustpilotUrl: string | null;
  referralLink: string | null;
  /** site_settings.referral_reward_text: il premio del referral come lo vede la famiglia */
  rewardText?: string | null;
}): { subject: string; paragraphs: string[]; text: string } {
  const { studentName, trustpilotUrl, referralLink, rewardText } = opts;
  const paragraphs = [`Grazie! Siamo felici che ${studentName} si stia trovando bene con TECHLAND.`];
  if (trustpilotUrl) {
    paragraphs.push(
      "Ci aiutereste con una recensione su Trustpilot? Bastano due minuti e per altre famiglie fa la differenza: " +
        trustpilotUrl,
    );
  }
  if (referralLink) {
    paragraphs.push(
      `Conoscete un'altra famiglia a cui potrebbe piacere? Questo è il vostro link d'invito: ${referralLink}` +
        (rewardText?.trim() ? `\n${rewardText.trim()}` : ""),
    );
  }
  return {
    subject: `Grazie per il vostro parere su ${studentName}`,
    paragraphs,
    text: `${paragraphs.join("\n\n")}\n\nIl Team TECHLAND`,
  };
}

/** Motivo dell'attività CRM per un voto basso. */
export function lowScoreLabel(score: number, kind: SurveyKind, moduleTitle: string | null): string {
  return kind === "after_3_lessons"
    ? `Sondaggio: ${score}/10 dopo le prime lezioni`
    : `Sondaggio: ${score}/10 a fine modulo${moduleTitle ? ` (${moduleTitle})` : ""}`;
}

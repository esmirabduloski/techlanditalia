/**
 * Logica pura dell'avviso "studente a rischio abbandono" (student-risk-check).
 * I segnali arrivano da public.student_risk_signals()
 * (drizzle/migrations/0028_student_risk_tasks.sql); qui si decide cosa fare
 * con l'attività CRM dello studente e si preparano i testi in italiano.
 */

export type RiskSignal =
  | { kind: "consecutive_absences"; group_id: string; group_title: string; count: number; dates: string[] }
  | { kind: "missing_homework"; count: number; items: { title: string; due: string }[] }
  | { kind: "streak_broken"; attendance: boolean; homework: boolean; best_attendance?: number | null; best_homework?: number | null }
  | { kind: "low_balance"; balance: number; threshold: number };

/** Segnale salvato in crm_tasks.signals: con il testo già pronto per il CRM. */
export type StoredSignal = RiskSignal & { key: string; label: string };

export type RiskRules = {
  enabled: boolean;
  absences_in_a_row: number;
  homework_missing_min: number;
  homework_window_days: number;
  streak_window_days: number;
  /** null = segnale disattivato */
  low_balance_threshold: number | null;
  /** Giorni dopo la chiusura di un'attività in cui gli stessi motivi non ne riaprono un'altra */
  cooldown_days: number;
};

export const DEFAULT_RULES: RiskRules = {
  enabled: true,
  absences_in_a_row: 2,
  homework_missing_min: 1,
  homework_window_days: 14,
  streak_window_days: 14,
  low_balance_threshold: 2,
  cooldown_days: 14,
};

export function parseRules(value: unknown): RiskRules {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const int = (k: keyof RiskRules, min: number) => {
    const n = Number(v[k]);
    return Number.isFinite(n) && v[k] !== null && v[k] !== "" ? Math.max(Math.round(n), min) : DEFAULT_RULES[k] as number;
  };
  return {
    enabled: v.enabled === undefined ? DEFAULT_RULES.enabled : v.enabled === true,
    absences_in_a_row: int("absences_in_a_row", 1),
    homework_missing_min: int("homework_missing_min", 1),
    homework_window_days: int("homework_window_days", 1),
    streak_window_days: int("streak_window_days", 1),
    low_balance_threshold: v.low_balance_threshold === null ? null : int("low_balance_threshold", 0),
    cooldown_days: int("cooldown_days", 0),
  };
}

/** Chiave che identifica il motivo: serve a capire se ne sono comparsi di nuovi. */
export function signalKeys(s: RiskSignal): string[] {
  switch (s.kind) {
    case "consecutive_absences":
      return [`consecutive_absences:${s.group_id}`];
    case "streak_broken":
      return [
        ...(s.attendance ? ["streak_broken:attendance"] : []),
        ...(s.homework ? ["streak_broken:homework"] : []),
      ];
    default:
      return [s.kind];
  }
}

export function describeSignal(s: RiskSignal): string {
  switch (s.kind) {
    case "consecutive_absences":
      return `${s.count} assenze di fila${s.group_title ? ` (${s.group_title})` : ""}`;
    case "missing_homework":
      return s.count === 1 && s.items[0]
        ? `Compito non consegnato: ${s.items[0].title}`
        : `${s.count} compiti non consegnati`;
    case "streak_broken":
      if (s.attendance && s.homework) return "Streak presenze e compiti azzerate";
      return s.attendance ? "Streak presenze azzerata" : "Streak compiti azzerata";
    case "low_balance":
      if (s.balance <= 0) return "Lezioni del pacchetto esaurite";
      return `Saldo basso: ${s.balance} ${s.balance === 1 ? "lezione" : "lezioni"}`;
  }
}

export function toStored(signals: RiskSignal[]): StoredSignal[] {
  return signals.map((s) => ({ ...s, key: signalKeys(s).join(","), label: describeSignal(s) }));
}

const keysOf = (signals: RiskSignal[]) => new Set(signals.flatMap(signalKeys));

/** JSON con le chiavi ordinate: jsonb riordina le chiavi, il confronto non deve dipenderne. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const sameSignals = (a: RiskSignal[], b: RiskSignal[]) => canonical(toStored(a)) === canonical(toStored(b));

type TaskLike = { signals: RiskSignal[] };
type ClosedTaskLike = TaskLike & { completed_at: string | null; updated_at: string };

export type TaskPlan =
  | { action: "none" }
  | { action: "create" }
  /** Attività già aperta: aggiorna i dati; newReasons non vuoto = motivi nuovi da annotare */
  | { action: "update"; newReasons: RiskSignal[] }
  /** Chiusa da poco con gli stessi motivi: non richiamare la famiglia */
  | { action: "cooldown" };

export function planTask(opts: {
  signals: RiskSignal[];
  open: TaskLike | null;
  lastClosed: ClosedTaskLike | null;
  now: Date;
  cooldownDays: number;
}): TaskPlan {
  const { signals, open, lastClosed, now, cooldownDays } = opts;
  if (signals.length === 0) return { action: "none" };

  if (open) {
    const before = keysOf(open.signals);
    const newReasons = signals.filter((s) => signalKeys(s).some((k) => !before.has(k)));
    return sameSignals(open.signals, signals) && newReasons.length === 0 ? { action: "none" } : { action: "update", newReasons };
  }

  if (lastClosed) {
    const closedAt = new Date(lastClosed.completed_at ?? lastClosed.updated_at).getTime();
    const recent = now.getTime() - closedAt < cooldownDays * 86_400_000;
    const closedKeys = keysOf(lastClosed.signals);
    if (recent && [...keysOf(signals)].every((k) => closedKeys.has(k))) return { action: "cooldown" };
  }
  return { action: "create" };
}

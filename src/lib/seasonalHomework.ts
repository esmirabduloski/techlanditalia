/**
 * Compiti stagionali (Halloween, Natale, Carnevale, Estate…).
 *
 * Un compito stagionale è una riga di `homework` con tema e corso: con
 * `lesson_id` NULL sta in archivio (gli alunni non lo vedono), con una lezione
 * compare come compito per casa di quella lezione. Inserire, spostare e
 * togliere cambiano solo `lesson_id`, così consegne e correzioni restano.
 */

// type e non interface: supabase-js vuole righe assegnabili a Record<string, unknown>
export type SeasonalTheme = {
  id: string;
  name: string;
  emoji: string;
  /** Richiesta standard, uguale per tutti i corsi */
  prompt: string;
  /** Quando proporlo, es. "fine ottobre" */
  period_hint: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SeasonalThemeDraft = Pick<SeasonalTheme, 'name' | 'emoji' | 'prompt' | 'period_hint'>;

/** Colonne di `homework` aggiunte da 0066_seasonal_homework */
export type SeasonalHomeworkColumns = {
  seasonal_theme_id: string | null;
  course_id: string | null;
};

export interface ScheduleRow {
  group_id: string;
  lesson_number: number;
  lesson_date: string;
}

export interface GroupLessonStatus {
  groupId: string;
  /** Ultima lezione fatta (data fino a oggi compreso) */
  last: { lesson_number: number; lesson_date: string } | null;
  /** Prima lezione dopo oggi */
  next: { lesson_number: number; lesson_date: string } | null;
}

export interface GroupHint extends GroupLessonStatus {
  title: string;
}

export const MAX_THEME_NAME_LENGTH = 40;

export function seasonalTitle(theme: Pick<SeasonalTheme, 'name' | 'emoji'>): string {
  return `${theme.emoji} Missione ${theme.name}`.trim();
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Testo di partenza di un compito nuovo: la richiesta standard del tema, da personalizzare per il corso */
export function seasonalPrefill(theme: Pick<SeasonalTheme, 'name' | 'emoji' | 'prompt'>) {
  const prompt = theme.prompt.trim();
  return {
    title: seasonalTitle(theme),
    description: prompt,
    instructions: prompt
      ? prompt.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
      : '',
  };
}

/** Problema nel tema da salvare, o null se va bene */
export function themeDraftError(draft: SeasonalThemeDraft, others: Pick<SeasonalTheme, 'name'>[]): string | null {
  const name = draft.name.trim();
  if (!name) return 'Il nome del tema è obbligatorio';
  if (name.length > MAX_THEME_NAME_LENGTH) return `Il nome può avere al massimo ${MAX_THEME_NAME_LENGTH} caratteri`;
  if (others.some((t) => t.name.trim().toLowerCase() === name.toLowerCase())) return `Esiste già un tema "${name}"`;
  return null;
}

/** Per ogni gruppo: l'ultima lezione fatta e la prossima, dal suo calendario */
export function groupLessonStatus(rows: ScheduleRow[], today: string): Map<string, GroupLessonStatus> {
  const byGroup = new Map<string, GroupLessonStatus>();
  for (const row of rows) {
    const status = byGroup.get(row.group_id) ?? { groupId: row.group_id, last: null, next: null };
    const entry = { lesson_number: row.lesson_number, lesson_date: row.lesson_date };
    if (row.lesson_date <= today) {
      if (!status.last || row.lesson_date > status.last.lesson_date) status.last = entry;
    } else if (!status.next || row.lesson_date < status.next.lesson_date) {
      status.next = entry;
    }
    byGroup.set(row.group_id, status);
  }
  return byGroup;
}

/**
 * Lezione in cui conviene inserire il compito: la prossima lezione più comune tra
 * i gruppi del corso (a parità, la più bassa), così il compito arriva subito dopo.
 * Senza calendari futuri usa la lezione dopo l'ultima fatta; null senza gruppi.
 */
export function suggestLesson(statuses: GroupLessonStatus[], validNumbers: number[]): number | null {
  const valid = new Set(validNumbers);
  const counts = new Map<number, number>();
  for (const s of statuses) {
    const n = s.next?.lesson_number ?? (s.last ? s.last.lesson_number + 1 : null);
    if (n !== null && valid.has(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [n, count] of counts) {
    const bestCount = best === null ? 0 : counts.get(best)!;
    if (count > bestCount || (count === bestCount && best !== null && n < best)) best = n;
  }
  return best;
}

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Scratch - Lunedì: fatta L5 il 20/10 · prossima L6 il 27/10" */
export function groupHintText(hint: GroupHint): string {
  const parts = [
    hint.last ? `fatta L${hint.last.lesson_number} il ${shortDate(hint.last.lesson_date)}` : 'non ancora iniziato',
    hint.next ? `prossima L${hint.next.lesson_number} il ${shortDate(hint.next.lesson_date)}` : 'nessuna lezione in calendario',
  ];
  return `${hint.title}: ${parts.join(' · ')}`;
}

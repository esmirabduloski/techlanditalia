// Cestino delle eliminazioni fatte dagli admin (drizzle/migrations/0069_trash.sql).
// Ogni batch è quello che è sparito con un click: la prima riga cancellata
// (root) e i conteggi per tabella di tutto quello che è sparito con lei.

export const TRASH_RETENTION_DAYS = 30;

/** Frase da aggiungere alle conferme di eliminazione delle pagine admin. */
export const TRASH_RECOVERY_HINT = `Resta recuperabile dal Cestino per ${TRASH_RETENTION_DAYS} giorni.`;

export interface TrashBatch {
  batch_id: string;
  deleted_at: string;
  deleted_by: string | null;
  root_table: string;
  root_data: Record<string, unknown>;
  counts: Record<string, number>;
  total: number;
}

/** Singolare (con la maiuscola, apre la frase) e plurale. */
interface TableLabel {
  one: string;
  many: string;
}

const TABLE_LABELS: Record<string, TableLabel> = {
  courses: { one: 'Corso', many: 'corsi' },
  lessons: { one: 'Lezione', many: 'lezioni' },
  lesson_tasks: { one: 'Task', many: 'task' },
  homework: { one: 'Compito', many: 'compiti' },
  homework_submissions: { one: 'Consegna', many: 'consegne' },
  homework_group_deadlines: { one: 'Scadenza di un compito', many: 'scadenze dei compiti' },
  seasonal_themes: { one: 'Tema stagionale', many: 'temi stagionali' },
  lesson_progress: { one: 'Lezione completata', many: 'lezioni completate' },
  task_progress: { one: 'Task completato', many: 'task completati' },
  student_code_drafts: { one: 'Bozza di codice', many: 'bozze di codice' },
  bookmarks: { one: 'Segnalibro', many: 'segnalibri' },
  student_groups: { one: 'Gruppo', many: 'gruppi' },
  group_students: { one: 'Alunno nel gruppo', many: 'alunni nei gruppi' },
  group_attendance: { one: 'Presenza', many: 'presenze' },
  group_lesson_schedule: { one: 'Lezione in calendario', many: 'lezioni in calendario' },
  group_comments: { one: 'Nota del gruppo', many: 'note dei gruppi' },
  lesson_reports: { one: 'Report di lezione', many: 'report di lezione' },
  course_certificates: { one: 'Attestato', many: 'attestati' },
  course_proposals: { one: 'Proposta di corso', many: 'proposte di corso' },
  scheduled_lessons: { one: 'Lezione programmata', many: 'lezioni programmate' },
  attendance: { one: 'Presenza a lezione programmata', many: 'presenze a lezioni programmate' },
  enrollments: { one: 'Iscrizione al corso', many: 'iscrizioni ai corsi' },
  teacher_courses: { one: 'Corso dell’insegnante', many: 'corsi degli insegnanti' },
  lesson_balance_log: { one: 'Movimento del monte lezioni', many: 'movimenti del monte lezioni' },
  teacher_background_checks: { one: 'Verifica del casellario', many: 'verifiche del casellario' },
  student_comments: { one: 'Commento su un alunno', many: 'commenti sugli alunni' },
  trial_bookings: { one: 'Prenotazione', many: 'prenotazioni' },
  contact_submissions: { one: 'Messaggio dal sito', many: 'messaggi dal sito' },
  job_applications: { one: 'Candidatura', many: 'candidature' },
  newsletter_subscribers: { one: 'Iscritto alla newsletter', many: 'iscritti alla newsletter' },
  referrals: { one: 'Invito (referral)', many: 'inviti (referral)' },
  crm_leads: { one: 'Lead CRM', many: 'lead CRM' },
  crm_payments: { one: 'Pagamento', many: 'pagamenti' },
  crm_interactions: { one: 'Interazione CRM', many: 'interazioni CRM' },
  crm_tasks: { one: 'Attività CRM', many: 'attività CRM' },
  subscription_cancellations: { one: 'Disdetta', many: 'disdette' },
  blog_posts: { one: 'Articolo del blog', many: 'articoli del blog' },
  glossary_terms: { one: 'Termine del glossario', many: 'termini del glossario' },
  landing_pages: { one: 'Landing page', many: 'landing page' },
  school_closures: { one: 'Chiusura', many: 'chiusure' },
  teacher_links: { one: 'Link insegnante', many: 'link insegnanti' },
  push_templates: { one: 'Modello di notifica', many: 'modelli di notifica' },
};

export function tableLabel(table: string, count = 1): string {
  const label = TABLE_LABELS[table];
  if (!label) return table;
  return count === 1 ? label.one : label.many;
}

const TITLE_FIELDS = ['title', 'name', 'full_name', 'term', 'parent_name', 'email', 'slug'] as const;

/** Nome leggibile di una riga eliminata (titolo, nome, email…), se ce l'ha. */
export function rowTitle(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  for (const field of TITLE_FIELDS) {
    const value = row[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** "Corso «Python base»", oppure "30 presenze" se il click ne ha cancellate tante. */
export function batchTitle(batch: Pick<TrashBatch, 'root_table' | 'root_data' | 'counts'>): string {
  const rootCount = batch.counts[batch.root_table] ?? 1;
  if (rootCount > 1) return `${rootCount} ${tableLabel(batch.root_table, rootCount)}`;
  const title = rowTitle(batch.root_data);
  const label = tableLabel(batch.root_table);
  return title ? `${label} «${title}»` : label;
}

/** Quello che è sparito insieme: "12 lezioni, 40 consegne e altri 3 elementi". */
export function batchContents(
  batch: Pick<TrashBatch, 'root_table' | 'counts'>,
  max = 4,
): string | null {
  const others = Object.entries(batch.counts)
    .filter(([table]) => table !== batch.root_table)
    .sort(([a, x], [b, y]) => y - x || tableLabel(a).localeCompare(tableLabel(b)));
  if (others.length === 0) return null;
  const shown = others
    .slice(0, max)
    .map(([table, n]) => `${n} ${tableLabel(table, n).replace(/^./, (c) => c.toLowerCase())}`);
  const rest = others.slice(max).reduce((sum, [, n]) => sum + n, 0);
  if (rest > 0) shown.push(`altri ${rest} element${rest === 1 ? 'o' : 'i'}`);
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
}

/** Giorni interi che restano prima della cancellazione automatica (mai negativi). */
export function daysLeft(deletedAt: string, now: Date = new Date()): number {
  const elapsed = (now.getTime() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsed));
}

/** Tipi presenti nel cestino, per il filtro (ordinati per etichetta). */
export function batchTypes(batches: Pick<TrashBatch, 'root_table'>[]): string[] {
  return [...new Set(batches.map((b) => b.root_table))].sort((a, b) =>
    tableLabel(a).localeCompare(tableLabel(b), 'it'),
  );
}

interface RpcError {
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** Errori di restore_trash_batch tradotti in un messaggio per l'admin. */
export function restoreErrorMessage(error: RpcError): string {
  const message = error.message ?? '';
  const what = error.details
    ? `${tableLabel(error.details)}${error.hint ? ` «${error.hint}»` : ''}`
    : 'Un elemento';
  if (message.startsWith('trash_conflict')) {
    return `${what} esiste già con gli stessi dati (per esempio lo stesso slug o la stessa email). Rinomina o elimina quello nuovo e riprova.`;
  }
  if (message.startsWith('trash_missing_parent')) {
    return `${what} dipende da qualcosa che è stato eliminato a parte (per esempio il corso o il gruppo). Ripristina prima quello e poi riprova.`;
  }
  if (message.startsWith('trash_not_found')) {
    return 'Non è più nel cestino: forse qualcuno l’ha appena ripristinato o eliminato.';
  }
  if (message.startsWith('trash_table_missing')) {
    return `Nel database non esiste più la tabella «${error.details ?? ''}»: non si può ripristinare.`;
  }
  if (message.startsWith('trash_failed')) {
    return `Ripristino non riuscito (${what}): ${message.replace(/^trash_failed:\s*/, '')}`;
  }
  return message || 'Ripristino non riuscito.';
}

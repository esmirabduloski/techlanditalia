/**
 * Mappa delle competenze di uno studente, allineata al quadro europeo DigComp 2.2
 * (migrazione 0062: lessons.concepts, student_skill_assessments e la funzione
 * student_skill_evidence).
 *
 * Il catalogo dei concetti vive qui e non nel database: l'admin collega ogni
 * lezione ai suoi concetti, la funzione SQL conta lezioni e compiti per
 * concetto e queste funzioni pure trasformano i conteggi in livelli. Ogni
 * concetto corrisponde a una sola competenza DigComp, e i livelli usano le
 * fasce ufficiali italiane (Base 1–2, Intermedio 3–4, Avanzato 5–6).
 * È un'indicazione basata sulle attività, non una certificazione.
 */

export type SkillLevel = 0 | 1 | 2 | 3;

export type DigcompCompetenceId = '1.3' | '3.1' | '3.4' | '5.1' | '5.3';

export type DigcompCompetence = {
  id: DigcompCompetenceId;
  area: string;
  title: string;
};

/** Competenze DigComp 2.2 toccate dai corsi, con i nomi della versione italiana. */
export const DIGCOMP_COMPETENCES: DigcompCompetence[] = [
  { id: '3.4', area: 'Creazione di contenuti digitali', title: 'Programmazione' },
  { id: '3.1', area: 'Creazione di contenuti digitali', title: 'Sviluppare contenuti digitali' },
  { id: '5.1', area: 'Risolvere problemi', title: 'Risolvere problemi tecnici' },
  { id: '5.3', area: 'Risolvere problemi', title: 'Utilizzare in modo creativo le tecnologie digitali' },
  { id: '1.3', area: 'Alfabetizzazione su informazioni e dati', title: 'Gestire dati, informazioni e contenuti digitali' },
];

export type SkillConcept = {
  id: string;
  label: string;
  emoji: string;
  digcomp: DigcompCompetenceId;
  /** Una frase comprensibile da un bambino e da un genitore. */
  description: string;
  /** Parole e pezzi di codice che suggeriscono il concetto nel testo di una lezione. */
  keywords: RegExp;
};

export const SKILL_CONCEPTS: SkillConcept[] = [
  {
    id: 'sequenze',
    label: 'Sequenze e algoritmi',
    emoji: '🧭',
    digcomp: '3.4',
    description: 'Mettere le istruzioni nell’ordine giusto per arrivare a un risultato.',
    keywords: /\b(sequenz\w*|algoritm\w*|passo dopo passo|diagramm\w* di flusso|pseudocodic\w*|unplugged)\b/i,
  },
  {
    id: 'variabili',
    label: 'Variabili',
    emoji: '📦',
    digcomp: '3.4',
    description: 'Dare un nome ai dati per ricordarli e cambiarli: punteggio, vite, nome del giocatore.',
    keywords: /\b(variabil\w*|assegnazion\w*)\b|\b(let|const|var)\s+[a-z_$][\w$]*\s*=/i,
  },
  {
    id: 'condizioni',
    label: 'Condizioni (se… allora)',
    emoji: '🔀',
    digcomp: '3.4',
    description: 'Far scegliere al programma cosa fare: se succede questo, allora fai quello.',
    keywords: /\b(condizion\w*|altrimenti|se\s*(?:\.\.\.|…)?\s*allora|if|elif|else|boolean\w*|operator\w* (?:logic|di confronto)\w*)\b/i,
  },
  {
    id: 'cicli',
    label: 'Cicli e ripetizioni',
    emoji: '🔁',
    digcomp: '3.4',
    description: 'Ripetere istruzioni senza riscriverle: “ripeti 10 volte”, “per sempre”.',
    keywords: /\b(cicl[oi]|ripeti\w*|ripetizion\w*|loop|for|while|per sempre|iterazion\w*)\b/i,
  },
  {
    id: 'funzioni',
    label: 'Funzioni',
    emoji: '🧩',
    digcomp: '3.4',
    description: 'Dare un nome a un gruppo di istruzioni per riusarlo quando serve.',
    keywords: /\b(funzion[ei]|procedur[ae]|blocch?i personalizzat\w*|parametr[oi]|return)\b|\bdef\s+\w+\s*\(|\bfunction\b/i,
  },
  {
    id: 'liste',
    label: 'Liste e strutture dati',
    emoji: '📋',
    digcomp: '3.4',
    description: 'Tenere insieme tanti dati: una lista di nemici, un inventario, una classifica.',
    keywords: /\b(list[ae]|array|dizionari?o?|tupl[ae]|vettor[ei])\b/i,
  },
  {
    id: 'eventi',
    label: 'Eventi e interazione',
    emoji: '🖱️',
    digcomp: '3.4',
    description: 'Far reagire il programma a un clic, a un tasto o a un messaggio.',
    keywords: /\b(event[oi]|quando (?:si )?(?:clicca|preme|tocca)\w*|onclick|addeventlistener|on_key_down|on_mouse_down|touched|broadcast)\b/i,
  },
  {
    id: 'oggetti',
    label: 'Oggetti e classi',
    emoji: '🏗️',
    digcomp: '3.4',
    description: 'Costruire “stampi” per creare tanti oggetti simili, ognuno con i suoi dati.',
    // Senza /i: "class Nome" è codice, "la classe" è l'aula
    keywords: /\b([Oo]ggetti e classi|[Pp]rogrammazione (?:orientata )?(?:a|agli) oggetti|__init__)|\bself\.\w+|\bclass\s+[A-Z]\w*\s*[:({]/,
  },
  {
    id: 'debug',
    label: 'Trovare e correggere errori',
    emoji: '🐞',
    digcomp: '5.1',
    description: 'Capire perché il programma non fa quello che vuoi e sistemarlo.',
    keywords: /\b(debug\w*|bug|error[ei]|traceback|eccezion[ei]|try|except)\b/i,
  },
  {
    id: 'progetti',
    label: 'Ideare e realizzare un progetto',
    emoji: '🚀',
    digcomp: '5.3',
    description: 'Partire da un’idea e arrivare a un gioco o un’app che funziona.',
    keywords: /\b(progett\w*|prototip\w*|gioco complet\w*|pubblic(?:a|are|azione)\w*)\b/i,
  },
  {
    id: 'web',
    label: 'Pagine web (HTML e CSS)',
    emoji: '🌐',
    digcomp: '3.1',
    description: 'Costruire pagine web con struttura, testi, immagini e stile.',
    keywords: /\b(html|css|pagin[ae] web|sit[oi] web|javascript|selettor[ei])\b/i,
  },
  {
    id: 'grafica',
    label: 'Grafica, animazioni e mondi 3D',
    emoji: '🎨',
    digcomp: '3.1',
    description: 'Disegnare, animare personaggi e costruire mondi da esplorare.',
    keywords: /\b(grafica|animazion\w*|sprite|costum[ei]|sfond[oi]|turtle|tartaruga|3d|coordinat\w*|pixel)\b/i,
  },
  {
    id: 'dati',
    label: 'Dati e intelligenza artificiale',
    emoji: '🤖',
    digcomp: '1.3',
    description: 'Raccogliere e analizzare dati, e capire come li usa l’intelligenza artificiale.',
    keywords: /\b(intelligenza artificiale|machine learning|chatbot|dataset|analisi (?:dei )?dati|modell\w* linguistic\w*|reti neurali|csv|pandas|prompt)\b/i,
  },
];

const CONCEPTS_BY_ID = new Map(SKILL_CONCEPTS.map((c) => [c.id, c]));

export function conceptById(id: string): SkillConcept | undefined {
  return CONCEPTS_BY_ID.get(id);
}

export type SkillLevelInfo = {
  level: SkillLevel;
  label: string;
  /** Livelli DigComp corrispondenti, es. "1–2". */
  digcomp: string | null;
  description: string;
};

export const SKILL_LEVELS: SkillLevelInfo[] = [
  { level: 0, label: 'Da scoprire', digcomp: null, description: 'Non ancora affrontato nelle lezioni.' },
  { level: 1, label: 'Base', digcomp: '1–2', description: 'Lo conosce e lo usa con un po’ di guida.' },
  { level: 2, label: 'Intermedio', digcomp: '3–4', description: 'Lo usa da solo per risolvere problemi.' },
  { level: 3, label: 'Avanzato', digcomp: '5–6', description: 'Lo usa con sicurezza in progetti nuovi e può aiutare gli altri.' },
];

export function levelInfo(level: SkillLevel): SkillLevelInfo {
  return SKILL_LEVELS[level];
}

export function isSkillLevel(value: unknown): value is SkillLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Contratto della 0062: una riga di student_skill_evidence. */
export type SkillEvidenceRow = {
  concept: string;
  /** Lezioni dei corsi dello studente collegate al concetto. */
  lessons_tagged: number;
  /** Completate sulla piattaforma o con presenza in classe. */
  lessons_met: number;
  lessons_completed: number;
  /** Compiti di quelle lezioni con un voto (dell'insegnante o automatico). */
  homework_scored: number;
  homework_avg: number | null;
  last_activity: string | null;
  course_ids: string[];
  teacher_level: number | null;
  teacher_note: string | null;
  assessed_at: string | null;
  assessed_by_name: string | null;
};

/** Contratto della 0062: la conferma dell'insegnante per un concetto. */
// type e non interface: supabase-js vuole righe assegnabili a Record<string, unknown>
export type SkillAssessment = {
  id: string;
  student_id: string;
  concept: string;
  level: number;
  note: string | null;
  assessed_by: string | null;
  created_at: string;
  updated_at: string;
};

export const MAX_ASSESSMENT_NOTE_LENGTH = 500;

/** Soglie del calcolo automatico; il livello Base basta una lezione incontrata. */
export const LEVEL_RULES = {
  intermedio: { lessonsCompleted: 2, homeworkScored: 1, homeworkAvg: 60 },
  avanzato: { lessonsCompleted: 4, homeworkScored: 2, homeworkAvg: 80 },
} as const;

type Evidence = Pick<SkillEvidenceRow, 'lessons_met' | 'lessons_completed' | 'homework_scored' | 'homework_avg'>;

function meets(e: Evidence, rule: { lessonsCompleted: number; homeworkScored: number; homeworkAvg: number }): boolean {
  return e.lessons_completed >= rule.lessonsCompleted
    && e.homework_scored >= rule.homeworkScored
    && (e.homework_avg ?? 0) >= rule.homeworkAvg;
}

/** Livello calcolato dalle attività, senza la conferma dell'insegnante. */
export function conceptLevel(e: Evidence): SkillLevel {
  if (meets(e, LEVEL_RULES.avanzato)) return 3;
  if (meets(e, LEVEL_RULES.intermedio)) return 2;
  if (e.lessons_met >= 1) return 1;
  return 0;
}

export type SkillMapEntry = {
  concept: SkillConcept;
  /** Livello mostrato: quello dell'insegnante se c'è, altrimenti il calcolato. */
  level: SkillLevel;
  autoLevel: SkillLevel;
  /** L'insegnante ha confermato o cambiato il livello. */
  confirmed: boolean;
  evidence: SkillEvidenceRow | null;
};

/** Il concetto fa parte dei corsi dello studente, o l'insegnante l'ha valutato. */
export function isRelevant(entry: SkillMapEntry): boolean {
  return entry.confirmed || (entry.evidence?.lessons_tagged ?? 0) > 0;
}

/**
 * Righe della funzione SQL → mappa in ordine di catalogo. Ignora i concetti
 * sconosciuti (tolti dal catalogo dopo il tag). Con `includeAll` (vista
 * insegnante) ci sono tutti i concetti, anche quelli senza lezioni collegate.
 */
export function buildSkillMap(rows: SkillEvidenceRow[], options: { includeAll?: boolean } = {}): SkillMapEntry[] {
  const byConcept = new Map(rows.map((r) => [r.concept, r]));
  const entries: SkillMapEntry[] = [];
  for (const concept of SKILL_CONCEPTS) {
    const evidence = byConcept.get(concept.id) ?? null;
    const autoLevel = evidence ? conceptLevel(evidence) : 0;
    const teacherLevel = evidence?.teacher_level;
    const confirmed = isSkillLevel(teacherLevel);
    const entry: SkillMapEntry = {
      concept,
      level: confirmed ? teacherLevel : autoLevel,
      autoLevel,
      confirmed,
      evidence,
    };
    if (options.includeAll || isRelevant(entry)) entries.push(entry);
  }
  return entries;
}

export type DigcompSummary = {
  competence: DigcompCompetence;
  level: SkillLevel;
  concepts: number;
};

/**
 * Livello di ogni competenza DigComp: il più alto raggiunto da almeno metà
 * dei suoi concetti. Contano solo i concetti dei corsi dello studente.
 */
export function digcompSummary(entries: SkillMapEntry[]): DigcompSummary[] {
  const summary: DigcompSummary[] = [];
  for (const competence of DIGCOMP_COMPETENCES) {
    const relevant = entries.filter((e) => e.concept.digcomp === competence.id && isRelevant(e));
    if (relevant.length === 0) continue;
    const needed = Math.ceil(relevant.length / 2);
    let level: SkillLevel = 0;
    for (const candidate of [3, 2, 1] as const) {
      if (relevant.filter((e) => e.level >= candidate).length >= needed) {
        level = candidate;
        break;
      }
    }
    summary.push({ competence, level, concepts: relevant.length });
  }
  return summary;
}

/** Concetti almeno a livello Base, per i riepiloghi ("5 avviate"). */
export function startedCount(entries: SkillMapEntry[]): number {
  return entries.filter((e) => e.level >= 1).length;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Perché questo livello: le attività contate, in una frase. */
export function evidenceText(entry: SkillMapEntry): string {
  const e = entry.evidence;
  if (!e || e.lessons_tagged === 0) return 'Nessuna lezione dei suoi corsi è ancora collegata a questo argomento.';
  const parts = [`${plural(e.lessons_met, 'lezione fatta', 'lezioni fatte')} su ${e.lessons_tagged} dedicat${e.lessons_tagged === 1 ? 'a' : 'e'} a questo argomento`];
  if (e.lessons_completed > 0) parts.push(`${e.lessons_completed} completat${e.lessons_completed === 1 ? 'a' : 'e'} sulla piattaforma`);
  if (e.homework_scored > 0) {
    parts.push(`${plural(e.homework_scored, 'compito valutato', 'compiti valutati')} (media ${formatScore(e.homework_avg)})`);
  }
  return `${parts.join(', ')}.`;
}

function formatScore(value: number | null): string {
  if (value == null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/** Cosa manca per il livello calcolato successivo; null se non c'è un passo chiaro. */
export function nextStepText(entry: SkillMapEntry): string | null {
  const e = entry.evidence;
  if (entry.confirmed || !e || e.lessons_tagged === 0 || entry.autoLevel === 3) return null;
  if (entry.autoLevel === 0) return 'Il livello Base arriva con la prima lezione su questo argomento.';
  const target = entry.autoLevel === 1 ? 2 : 3;
  const rule = target === 2 ? LEVEL_RULES.intermedio : LEVEL_RULES.avanzato;
  const missing: string[] = [];
  const lessons = rule.lessonsCompleted - e.lessons_completed;
  if (lessons > 0) missing.push(`completare ancora ${plural(lessons, 'lezione', 'lezioni')} sulla piattaforma`);
  const homework = rule.homeworkScored - e.homework_scored;
  if (homework > 0) missing.push(`avere ${plural(homework, 'altro compito valutato', 'altri compiti valutati')}`);
  else if ((e.homework_avg ?? 0) < rule.homeworkAvg) {
    missing.push(`portare la media dei compiti a ${rule.homeworkAvg} (ora ${formatScore(e.homework_avg)})`);
  }
  if (missing.length === 0) return null;
  return `Per arrivare al livello ${levelInfo(target).label}: ${missing.join(' e ')}.`;
}

/** Testo semplice di una lezione: niente tag HTML né entità. */
function plainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}

/** Concetti suggeriti dal testo della lezione (titolo, obiettivo, contenuto), in ordine di catalogo. */
export function suggestConcepts(text: string): string[] {
  const plain = plainText(text);
  return SKILL_CONCEPTS.filter((c) => c.keywords.test(plain)).map((c) => c.id);
}

export type ConceptCoverage = {
  /** Concetti del catalogo usati nel corso, con quante lezioni li trattano. */
  concepts: { concept: SkillConcept; lessons: number }[];
  /** Lezioni senza nessun concetto collegato. */
  untagged: number;
};

/** Quali concetti copre un corso; null se la colonna concepts non c'è ancora (0062 non applicata). */
export function conceptCoverage(lessons: { concepts?: readonly unknown[] | null }[]): ConceptCoverage | null {
  if (lessons.length === 0 || !lessons.some((l) => Array.isArray(l.concepts))) return null;
  const counts = new Map<string, number>();
  let untagged = 0;
  for (const lesson of lessons) {
    const ids = normalizeConcepts(lesson.concepts);
    if (ids.length === 0) untagged++;
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return {
    concepts: SKILL_CONCEPTS.filter((c) => counts.has(c.id)).map((c) => ({ concept: c, lessons: counts.get(c.id)! })),
    untagged,
  };
}

/** Solo id del catalogo, senza doppioni, in ordine di catalogo. */
export function normalizeConcepts(ids: readonly unknown[] | null | undefined): string[] {
  const set = new Set((ids ?? []).filter((id): id is string => typeof id === 'string'));
  return SKILL_CONCEPTS.filter((c) => set.has(c.id)).map((c) => c.id);
}

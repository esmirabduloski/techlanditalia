// Task di tipo "quiz": il contenuto (lesson_tasks.content) è un JSON.
// Due forme ammesse:
//   1) quiz completo: { "titolo": "...", "domande": [ ... ] }
//   2) collegamento a un'altra task quiz: { "quiz_da_task": "<id task>" }
// Le risposte degli studenti NON vanno nel database: restano solo nel browser.

export type QuizQuestionType = 'scelta_multipla' | 'vero_falso';

export interface QuizQuestion {
  id: number | string;
  tipo: QuizQuestionType;
  domanda: string;
  risposte_possibili: string[];
  risposta_corretta: string;
  spiegazione?: string;
}

export interface QuizData {
  titolo?: string;
  domande: QuizQuestion[];
}

export type ParsedQuizContent =
  | { kind: 'quiz'; quiz: QuizData }
  | { kind: 'ref'; taskId: string }
  | { kind: 'error'; message: string };

const TRUE_FALSE = ['Vero', 'Falso'];

export function parseQuizContent(raw: string | null | undefined): ParsedQuizContent {
  if (!raw || !raw.trim()) return { kind: 'error', message: 'Il quiz è vuoto.' };

  let json: Record<string, any>;  // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: 'error', message: 'Il JSON del quiz non è valido (controlla virgole e virgolette).' };
  }

  if (json && typeof json.quiz_da_task === 'string' && json.quiz_da_task.trim()) {
    return { kind: 'ref', taskId: json.quiz_da_task.trim() };
  }

  if (!json || !Array.isArray(json.domande) || json.domande.length === 0) {
    return { kind: 'error', message: 'Manca l\'elenco "domande" (o è vuoto).' };
  }

  const domande: QuizQuestion[] = [];
  for (let i = 0; i < json.domande.length; i++) {
    const q = json.domande[i];
    const n = i + 1;
    if (!q || typeof q.domanda !== 'string' || !q.domanda.trim()) {
      return { kind: 'error', message: `Domanda ${n}: manca il testo "domanda".` };
    }
    const tipo: QuizQuestionType = q.tipo === 'vero_falso' ? 'vero_falso' : 'scelta_multipla';
    const opzioni: string[] =
      tipo === 'vero_falso'
        ? TRUE_FALSE
        : Array.isArray(q.risposte_possibili)
          ? q.risposte_possibili.map((o: unknown) => String(o)).filter((o: string) => o.trim())
          : [];
    if (opzioni.length < 2) {
      return { kind: 'error', message: `Domanda ${n}: servono almeno 2 "risposte_possibili".` };
    }
    const corretta = opzioni.find(
      (o) => o.trim().toLowerCase() === String(q.risposta_corretta ?? '').trim().toLowerCase(),
    );
    if (!corretta) {
      return {
        kind: 'error',
        message: `Domanda ${n}: "risposta_corretta" deve essere uguale a una delle risposte possibili.`,
      };
    }
    domande.push({
      id: q.id ?? n,
      tipo,
      domanda: q.domanda.trim(),
      risposte_possibili: opzioni,
      risposta_corretta: corretta,
      spiegazione: typeof q.spiegazione === 'string' && q.spiegazione.trim() ? q.spiegazione.trim() : undefined,
    });
  }

  return {
    kind: 'quiz',
    quiz: { titolo: typeof json.titolo === 'string' ? json.titolo : undefined, domande },
  };
}

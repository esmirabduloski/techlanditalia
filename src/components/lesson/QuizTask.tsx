import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Eye, Loader2, Play, RotateCcw, Sparkles, Star, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseQuizContent, type QuizData, type QuizQuestion } from '@/lib/quiz';
import mascotte from '@/assets/mascotte-techland.webp';

interface QuizTaskProps {
  /** Contenuto JSON della task (quiz completo o collegamento a un'altra task quiz). */
  content: string | null;
  /** Chiave per ricordare la partita nel browser (es. id della task). Nessun salvataggio su DB. */
  storageKey: string;
  /** Vista insegnante: mostra subito tutte le soluzioni. */
  teacherMode?: boolean;
  /** Chiamata una sola volta quando lo studente arriva alla fine del quiz. */
  onFinish?: () => void;
}

interface Session {
  signature: string;
  optionOrder: string[][];
  answers: (string | null)[];
  current: number;
  finished: boolean;
}

type Phase = 'intro' | 'resume' | 'question' | 'results' | 'solutions';

const STORAGE_PREFIX = 'techland-quiz:';

// Colori delle risposte a scelta multipla (stile "gioco a quiz").
const OPTION_STYLES = [
  { bg: 'bg-rose-500', ring: 'ring-rose-300', shadow: 'shadow-[0_6px_0_#be123c]', shape: '▲' },
  { bg: 'bg-sky-500', ring: 'ring-sky-300', shadow: 'shadow-[0_6px_0_#0369a1]', shape: '◆' },
  { bg: 'bg-amber-400', ring: 'ring-amber-200', shadow: 'shadow-[0_6px_0_#b45309]', shape: '●' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-300', shadow: 'shadow-[0_6px_0_#047857]', shape: '■' },
];
const TRUE_FALSE_STYLES: Record<string, (typeof OPTION_STYLES)[number] & { emoji: string }> = {
  Vero: { bg: 'bg-emerald-500', ring: 'ring-emerald-300', shadow: 'shadow-[0_6px_0_#047857]', shape: '', emoji: '👍' },
  Falso: { bg: 'bg-violet-500', ring: 'ring-violet-300', shadow: 'shadow-[0_6px_0_#6d28d9]', shape: '', emoji: '👎' },
};

const CORRECT_MESSAGES = ['Grande! 🎉', 'Esatto! ⭐', 'Bravissimo! 🚀', 'Perfetto! 🏆', 'Sei un campione! 💪'];
const WRONG_MESSAGES = ['Quasi! 💪', 'Ci sei andato vicino! 🙂', 'Niente paura, ora lo sai! ✨', 'Buon tentativo! 🌟'];

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pick = (items: string[], seed: number) => items[seed % items.length];

const quizSignature = (quiz: QuizData) =>
  quiz.domande.map((q) => `${q.domanda}|${q.risposta_corretta}|${q.risposte_possibili.length}`).join('~');

const newSession = (quiz: QuizData): Session => ({
  signature: quizSignature(quiz),
  optionOrder: quiz.domande.map((q) =>
    q.tipo === 'vero_falso' ? q.risposte_possibili : shuffle(q.risposte_possibili),
  ),
  answers: quiz.domande.map(() => null),
  current: 0,
  finished: false,
});

const readSession = (key: string, quiz: QuizData): Session | null => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Session;
    if (saved.signature !== quizSignature(quiz)) return null;
    return saved;
  } catch {
    return null;
  }
};

const writeSession = (key: string, session: Session) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(session));
  } catch {
    // Storage non disponibile (es. navigazione privata): il quiz funziona lo stesso.
  }
};

const countCorrect = (quiz: QuizData, answers: (string | null)[]) =>
  quiz.domande.reduce((n, q, i) => (answers[i] === q.risposta_corretta ? n + 1 : n), 0);

export function QuizTask({ content, storageKey, teacherMode = false, onFinish }: QuizTaskProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carica il quiz (anche se è un collegamento a un'altra task).
  useEffect(() => {
    let cancelled = false;
    setQuiz(null);
    setError(null);

    const load = async () => {
      const parsed = parseQuizContent(content);
      if (parsed.kind === 'quiz') return setQuiz(parsed.quiz);
      if (parsed.kind === 'error') return setError(parsed.message);

      const { data } = await supabase
        .from('lesson_tasks')
        .select('content, content_type')
        .eq('id', parsed.taskId)
        .maybeSingle();
      if (cancelled) return;
      const linked = parseQuizContent(data?.content_type === 'quiz' ? data.content : null);
      if (linked.kind === 'quiz') setQuiz(linked.quiz);
      else setError('Il quiz collegato non è stato trovato.');
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">😕 Questo quiz non si può aprire</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <QuizGame key={content ?? ''} quiz={quiz} storageKey={storageKey} teacherMode={teacherMode} onFinish={onFinish} />;
}

function QuizGame({
  quiz,
  storageKey,
  teacherMode,
  onFinish,
}: {
  quiz: QuizData;
  storageKey: string;
  teacherMode: boolean;
  onFinish?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const persist = !teacherMode;
  const total = quiz.domande.length;

  const [session, setSession] = useState<Session>(() => (persist && readSession(storageKey, quiz)) || newSession(quiz));
  const [phase, setPhase] = useState<Phase>(() => {
    if (teacherMode) return 'solutions';
    const saved = readSession(storageKey, quiz);
    return saved && (saved.finished || saved.answers.some((a) => a !== null)) ? 'resume' : 'intro';
  });

  const update = useCallback(
    (next: Session) => {
      setSession(next);
      if (persist) writeSession(storageKey, next);
    },
    [persist, storageKey],
  );

  const start = () => {
    update(newSession(quiz));
    setPhase('question');
  };

  const answer = (option: string) => {
    if (session.answers[session.current] !== null) return;
    const answers = [...session.answers];
    answers[session.current] = option;
    update({ ...session, answers });
  };

  const next = () => {
    if (session.current < total - 1) {
      update({ ...session, current: session.current + 1 });
      return;
    }
    const wasFinished = session.finished;
    update({ ...session, finished: true });
    setPhase('results');
    if (!wasFinished && !teacherMode) onFinish?.();
  };

  const score = countCorrect(quiz, session.answers);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 p-4 sm:p-8 shadow-xl text-slate-900 not-prose">
      <Decorations />
      <div className="relative">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <Screen key="intro" reduceMotion={reduceMotion}>
              <IntroScreen quiz={quiz} onStart={start} reduceMotion={reduceMotion} />
            </Screen>
          )}

          {phase === 'resume' && (
            <Screen key="resume" reduceMotion={reduceMotion}>
              <ResumeScreen
                finished={session.finished}
                score={score}
                total={total}
                answered={session.answers.filter((a) => a !== null).length}
                onRestart={start}
                onContinue={() => setPhase(session.finished ? 'results' : 'question')}
              />
            </Screen>
          )}

          {phase === 'question' && (
            <Screen key={`q-${session.current}`} reduceMotion={reduceMotion}>
              <QuestionScreen
                question={quiz.domande[session.current]}
                options={session.optionOrder[session.current]}
                index={session.current}
                total={total}
                answers={session.answers}
                quiz={quiz}
                chosen={session.answers[session.current]}
                onAnswer={answer}
                onNext={next}
                reduceMotion={reduceMotion}
              />
            </Screen>
          )}

          {phase === 'results' && (
            <Screen key="results" reduceMotion={reduceMotion}>
              <ResultsScreen quiz={quiz} session={session} score={score} onRestart={start} reduceMotion={reduceMotion} />
            </Screen>
          )}

          {phase === 'solutions' && (
            <Screen key="solutions" reduceMotion={reduceMotion}>
              <SolutionsScreen quiz={quiz} onPlay={start} />
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Screen({ children, reduceMotion }: { children: React.ReactNode; reduceMotion: boolean | null }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function Mascot({
  size,
  mood = 'idle',
  reduceMotion,
}: {
  size: string;
  mood?: 'idle' | 'happy' | 'oops';
  reduceMotion: boolean | null;
}) {
  const animate = reduceMotion
    ? {}
    : mood === 'happy'
      ? { y: [0, -18, 0, -8, 0], rotate: [0, -6, 6, 0] }
      : mood === 'oops'
        ? { rotate: [0, -5, 5, -3, 0] }
        : { y: [0, -6, 0] };
  const transition =
    mood === 'idle' ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const } : { duration: 0.7 };

  return (
    <motion.img
      key={mood}
      src={mascotte}
      alt="Mascotte Techland"
      className={`${size} shrink-0 select-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)]`}
      draggable={false}
      animate={animate}
      transition={transition}
    />
  );
}

function IntroScreen({
  quiz,
  onStart,
  reduceMotion,
}: {
  quiz: QuizData;
  onStart: () => void;
  reduceMotion: boolean | null;
}) {
  const multi = quiz.domande.filter((q) => q.tipo === 'scelta_multipla').length;
  const tf = quiz.domande.length - multi;
  return (
    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 py-4">
      <Mascot size="w-44 sm:w-56" reduceMotion={reduceMotion} />
      <div className="flex-1 text-center md:text-left">
        <Bubble>
          <p className="text-sm font-bold uppercase tracking-wider text-indigo-500">Quiz di ripasso</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">
            {quiz.titolo || 'Mettiti alla prova!'}
          </h2>
          <p className="mt-3 text-slate-600">
            Ciao! Ti faccio <strong>{quiz.domande.length} domande</strong> su quello che hai imparato. Dopo ogni
            risposta ti dico subito se è giusta. Pronto? 🚀
          </p>
          <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2 text-sm font-semibold">
            {multi > 0 && <Chip className="bg-sky-100 text-sky-700">🎯 {multi} a scelta multipla</Chip>}
            {tf > 0 && <Chip className="bg-emerald-100 text-emerald-700">✅ {tf} vero o falso</Chip>}
          </div>
        </Bubble>
        <BigButton onClick={onStart} className="mt-6 bg-amber-400 text-slate-900 shadow-[0_6px_0_#b45309]">
          <Play className="w-6 h-6 fill-current" /> Inizia il quiz!
        </BigButton>
      </div>
    </div>
  );
}

function ResumeScreen({
  finished,
  score,
  total,
  answered,
  onRestart,
  onContinue,
}: {
  finished: boolean;
  score: number;
  total: number;
  answered: number;
  onRestart: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <img src={mascotte} alt="Mascotte Techland" className="w-36 sm:w-44 drop-shadow-xl" draggable={false} />
      <Bubble className="max-w-lg">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Bentornato! 👋</h2>
        <p className="mt-2 text-slate-600">
          {finished ? (
            <>
              Hai già finito questo quiz con <strong>{score} risposte giuste su {total}</strong>. Vuoi rivedere le
              risposte o riprovare?
            </>
          ) : (
            <>
              Ti eri fermato a metà: hai risposto a <strong>{answered} domande su {total}</strong>.
            </>
          )}
        </p>
      </Bubble>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <BigButton onClick={onContinue} className="bg-white text-indigo-700 shadow-[0_6px_0_#c7d2fe]">
          {finished ? <Eye className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
          {finished ? 'Vedi risultati' : 'Continua'}
        </BigButton>
        <BigButton onClick={onRestart} className="bg-amber-400 text-slate-900 shadow-[0_6px_0_#b45309]">
          <RotateCcw className="w-6 h-6" /> Ricomincia da capo
        </BigButton>
      </div>
    </div>
  );
}

function QuestionScreen({
  question,
  options,
  index,
  total,
  answers,
  quiz,
  chosen,
  onAnswer,
  onNext,
  reduceMotion,
}: {
  question: QuizQuestion;
  options: string[];
  index: number;
  total: number;
  answers: (string | null)[];
  quiz: QuizData;
  chosen: string | null;
  onAnswer: (option: string) => void;
  onNext: () => void;
  reduceMotion: boolean | null;
}) {
  const answered = chosen !== null;
  const isCorrect = chosen === question.risposta_corretta;
  const isTrueFalse = question.tipo === 'vero_falso';
  const isLast = index === total - 1;

  return (
    <div>
      <ProgressDots quiz={quiz} answers={answers} current={index} />

      <div className="mt-5 flex items-end gap-3 sm:gap-5">
        <Mascot
          size="w-20 sm:w-28"
          mood={!answered ? 'idle' : isCorrect ? 'happy' : 'oops'}
          reduceMotion={reduceMotion}
        />
        <Bubble tail className="flex-1">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-500">
            Domanda {index + 1} di {total} · {isTrueFalse ? 'Vero o falso?' : 'Scegli la risposta giusta'}
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold leading-snug text-slate-900">{question.domanda}</h2>
        </Bubble>
      </div>

      <div className={`mt-6 grid gap-3 sm:gap-4 ${isTrueFalse ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
        {options.map((option, i) => {
          const style = isTrueFalse ? TRUE_FALSE_STYLES[option] ?? OPTION_STYLES[i] : OPTION_STYLES[i % 4];
          const isRight = option === question.risposta_corretta;
          const isChosen = option === chosen;
          let state = '';
          if (answered) {
            if (isRight) state = 'ring-4 ring-white scale-[1.02]';
            else if (isChosen) state = 'opacity-90';
            else state = 'opacity-40 saturate-50';
          }
          return (
            <motion.button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => onAnswer(option)}
              whileHover={answered || reduceMotion ? undefined : { y: -3 }}
              whileTap={answered || reduceMotion ? undefined : { y: 4 }}
              className={`relative flex items-center gap-3 rounded-2xl px-4 sm:px-5 text-left font-bold text-white transition-all
                ${isTrueFalse ? 'min-h-[88px] sm:min-h-[110px] justify-center text-xl sm:text-2xl' : 'min-h-[72px] text-base sm:text-lg'}
                ${style.bg} ${style.shadow} ${state}
                ${answered ? 'cursor-default' : 'hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 ' + style.ring}`}
            >
              {isTrueFalse ? (
                <span className="text-3xl sm:text-4xl" aria-hidden>
                  {TRUE_FALSE_STYLES[option]?.emoji}
                </span>
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/25 text-lg"
                  aria-hidden
                >
                  {style.shape}
                </span>
              )}
              <span className="drop-shadow-sm">{option}</span>
              {answered && (isRight || isChosen) && (
                <span
                  className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ${
                    isRight ? 'text-emerald-600' : 'text-orange-500'
                  }`}
                >
                  {isRight ? <Check className="h-5 w-5" strokeWidth={3} /> : <X className="h-5 w-5" strokeWidth={3} />}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
              isCorrect ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-orange-50 border-2 border-orange-300'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex-1">
              <p className={`text-xl font-black ${isCorrect ? 'text-emerald-700' : 'text-orange-600'}`}>
                {isCorrect ? pick(CORRECT_MESSAGES, index) : pick(WRONG_MESSAGES, index)}
              </p>
              {!isCorrect && (
                <p className="mt-1 text-slate-700">
                  La risposta giusta è: <strong className="text-emerald-700">{question.risposta_corretta}</strong>
                </p>
              )}
              {question.spiegazione && <p className="mt-1 text-slate-600">💡 {question.spiegazione}</p>}
            </div>
            <BigButton onClick={onNext} className="bg-indigo-600 text-white shadow-[0_6px_0_#3730a3] sm:w-auto" autoFocus>
              {isLast ? 'Vedi il risultato 🏆' : 'Avanti'}
              {!isLast && <ArrowRight className="w-6 h-6" />}
            </BigButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProgressDots({ quiz, answers, current }: { quiz: QuizData; answers: (string | null)[]; current: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" aria-label="Avanzamento del quiz">
      {quiz.domande.map((q, i) => {
        const a = answers[i];
        const color =
          a === null
            ? i === current
              ? 'bg-white text-indigo-600 scale-110 ring-4 ring-white/40'
              : 'bg-white/25 text-white'
            : a === q.risposta_corretta
              ? 'bg-emerald-400 text-white'
              : 'bg-orange-400 text-white';
        return (
          <span
            key={i}
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-xs sm:text-sm font-black transition-all ${color}`}
          >
            {i + 1}
          </span>
        );
      })}
    </div>
  );
}

function ResultsScreen({
  quiz,
  session,
  score,
  onRestart,
  reduceMotion,
}: {
  quiz: QuizData;
  session: Session;
  score: number;
  onRestart: () => void;
  reduceMotion: boolean | null;
}) {
  const total = quiz.domande.length;
  const ratio = score / total;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
  const title =
    ratio === 1
      ? 'Perfetto! Tutto giusto! 🏆'
      : ratio >= 0.8
        ? 'Fantastico! 🎉'
        : ratio >= 0.6
          ? 'Ottimo lavoro! 👏'
          : ratio >= 0.4
            ? 'Buon inizio! 💪'
            : 'Continua così, stai imparando! 🌱';

  return (
    <div>
      {!reduceMotion && <Confetti />}
      <div className="flex flex-col items-center text-center">
        <Mascot size="w-36 sm:w-44" mood="happy" reduceMotion={reduceMotion} />
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={reduceMotion ? false : { scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25 + i * 0.2, type: 'spring', stiffness: 260, damping: 14 }}
            >
              <Star
                className={`h-10 w-10 sm:h-12 sm:w-12 ${
                  i < stars ? 'fill-amber-300 text-amber-400 drop-shadow' : 'fill-white/20 text-white/40'
                }`}
              />
            </motion.span>
          ))}
        </div>
        <h2 className="mt-3 text-3xl sm:text-4xl font-black text-white drop-shadow">{title}</h2>
        <p className="mt-2 text-lg sm:text-xl font-bold text-white/90">
          Hai risposto giusto a <span className="text-amber-300 text-2xl sm:text-3xl">{score}</span> domande su{' '}
          {total}
        </p>
        <BigButton onClick={onRestart} className="mt-5 bg-amber-400 text-slate-900 shadow-[0_6px_0_#b45309]">
          <RotateCcw className="w-6 h-6" /> Rifai il quiz
        </BigButton>
      </div>

      <div className="mt-8 rounded-2xl bg-white/95 p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <Sparkles className="h-5 w-5 text-indigo-500" /> Le tue risposte
        </h3>
        <ol className="mt-4 space-y-3">
          {quiz.domande.map((q, i) => {
            const given = session.answers[i];
            const ok = given === q.risposta_corretta;
            return (
              <li
                key={i}
                className={`rounded-xl border-2 p-3 sm:p-4 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                      ok ? 'bg-emerald-500' : 'bg-orange-400'
                    }`}
                  >
                    {ok ? <Check className="h-5 w-5" strokeWidth={3} /> : <X className="h-5 w-5" strokeWidth={3} />}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">
                      {i + 1}. {q.domanda}
                    </p>
                    {!ok && (
                      <p className="mt-1 text-sm text-slate-600">
                        La tua risposta: <span className="line-through decoration-orange-400">{given ?? '—'}</span>
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-700">
                      Risposta giusta: <strong className="text-emerald-700">{q.risposta_corretta}</strong>
                    </p>
                    {q.spiegazione && <p className="mt-1 text-sm text-slate-500">💡 {q.spiegazione}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function SolutionsScreen({ quiz, onPlay }: { quiz: QuizData; onPlay: () => void }) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <img src={mascotte} alt="Mascotte Techland" className="w-24 drop-shadow-xl" draggable={false} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm font-bold uppercase tracking-wider text-white/80">Vista insegnante · Soluzioni</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow">{quiz.titolo || 'Quiz'}</h2>
        </div>
        <BigButton onClick={onPlay} className="bg-amber-400 text-slate-900 shadow-[0_6px_0_#b45309] sm:w-auto">
          <Play className="w-5 h-5 fill-current" /> Prova il quiz
        </BigButton>
      </div>
      <ol className="mt-6 space-y-3">
        {quiz.domande.map((q, i) => (
          <li key={i} className="rounded-2xl bg-white/95 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              {i + 1} · {q.tipo === 'vero_falso' ? 'Vero o falso' : 'Scelta multipla'}
            </p>
            <p className="mt-1 font-bold text-slate-900">{q.domanda}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.risposte_possibili.map((o) => {
                const right = o === q.risposta_corretta;
                return (
                  <li
                    key={o}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                      right ? 'bg-emerald-100 font-bold text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {right ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="w-4" />}
                    {o}
                  </li>
                );
              })}
            </ul>
            {q.spiegazione && <p className="mt-2 text-sm text-slate-500">💡 {q.spiegazione}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// --- piccoli mattoncini grafici ---

function Bubble({ children, className = '', tail = false }: { children: React.ReactNode; className?: string; tail?: boolean }) {
  return (
    <div className={`relative rounded-3xl bg-white p-5 sm:p-6 shadow-lg ${className}`}>
      {tail && (
        <span
          aria-hidden
          className="absolute -left-2 bottom-6 h-5 w-5 rotate-45 rounded-sm bg-white"
        />
      )}
      {children}
    </div>
  );
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full px-3 py-1 ${className}`}>{children}</span>;
}

function BigButton({
  children,
  className = '',
  onClick,
  autoFocus,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-lg font-black transition-transform
        hover:-translate-y-0.5 active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${className}`}
    >
      {children}
    </button>
  );
}

function Decorations() {
  // Mattoncini e stelline sullo sfondo, solo decorativi.
  const items = [
    { c: 'bg-amber-300', s: 'h-10 w-10 rounded-lg rotate-12', p: 'top-4 right-6' },
    { c: 'bg-rose-400', s: 'h-6 w-6 rounded-md -rotate-12', p: 'top-24 right-24' },
    { c: 'bg-emerald-300', s: 'h-8 w-8 rounded-lg rotate-6', p: 'bottom-10 left-6' },
    { c: 'bg-sky-200', s: 'h-5 w-5 rounded-md rotate-45', p: 'bottom-24 right-10' },
    { c: 'bg-white', s: 'h-16 w-16 rounded-full', p: '-top-6 -left-6' },
    { c: 'bg-fuchsia-300', s: 'h-24 w-24 rounded-full', p: '-bottom-10 -right-8' },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {items.map((d, i) => (
        <span key={i} className={`absolute opacity-30 ${d.c} ${d.s} ${d.p}`} />
      ))}
      <span className="absolute top-10 left-1/3 text-2xl opacity-60">✨</span>
      <span className="absolute bottom-6 left-1/2 text-xl opacity-50">⭐</span>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 720 - 360,
        drift: Math.random() * 80 - 40,
        color: ['#fbbf24', '#f43f5e', '#22c55e', '#38bdf8', '#a78bfa', '#ffffff'][i % 6],
        round: i % 3 === 0,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-[520px] overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '2px',
          }}
          initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: 520, x: p.drift, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

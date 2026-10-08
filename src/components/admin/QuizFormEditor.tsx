import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestionType } from '@/lib/quiz';

// Editor "a modulo" del quiz: lavora su una bozza permissiva (domande incomplete ammesse)
// e la riscrive come JSON a ogni modifica. La validazione vera resta in parseQuizContent.

interface DraftQuestion {
  key: string;
  id: number | string;
  tipo: QuizQuestionType;
  domanda: string;
  risposte: string[];
  corretta: number; // indice in risposte, -1 = non scelta
  spiegazione: string;
}

interface Draft {
  titolo: string;
  domande: DraftQuestion[];
}

const TRUE_FALSE = ['Vero', 'Falso'];

let keySeq = 0;
const newKey = () => `q${++keySeq}`;

const blankQuestion = (id: number | string): DraftQuestion => ({
  key: newKey(),
  id,
  tipo: 'scelta_multipla',
  domanda: '',
  risposte: ['', ''],
  corretta: -1,
  spiegazione: '',
});

/** Legge il JSON senza validarlo a fondo. Ritorna null se non è un quiz modificabile. */
export function draftFromJson(raw: string): Draft | null {
  if (!raw.trim()) return { titolo: '', domande: [] };
  let json: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object' || json.quiz_da_task) return null;
  const list = Array.isArray(json.domande) ? json.domande : [];
  return {
    titolo: typeof json.titolo === 'string' ? json.titolo : '',
    domande: list.map((q: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const tipo: QuizQuestionType = q?.tipo === 'vero_falso' ? 'vero_falso' : 'scelta_multipla';
      const risposte: string[] =
        tipo === 'vero_falso'
          ? TRUE_FALSE
          : Array.isArray(q?.risposte_possibili)
            ? q.risposte_possibili.map((o: unknown) => String(o))
            : [];
      const target = String(q?.risposta_corretta ?? '').trim().toLowerCase();
      return {
        key: newKey(),
        id: q?.id ?? i + 1,
        tipo,
        domanda: typeof q?.domanda === 'string' ? q.domanda : '',
        risposte,
        corretta: target ? risposte.findIndex((o) => o.trim().toLowerCase() === target) : -1,
        spiegazione: typeof q?.spiegazione === 'string' ? q.spiegazione : '',
      };
    }),
  };
}

function draftToJson(draft: Draft): string {
  return JSON.stringify(
    {
      ...(draft.titolo.trim() ? { titolo: draft.titolo } : {}),
      domande: draft.domande.map((q) => ({
        id: q.id,
        tipo: q.tipo,
        domanda: q.domanda,
        risposte_possibili: q.risposte,
        risposta_corretta: q.risposte[q.corretta] ?? '',
        ...(q.spiegazione.trim() ? { spiegazione: q.spiegazione } : {}),
      })),
    },
    null,
    2,
  );
}

const nextId = (domande: DraftQuestion[]) =>
  domande.reduce((max, q) => (typeof q.id === 'number' && q.id > max ? q.id : max), 0) + 1;

interface QuizFormEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export function QuizFormEditor({ value, onChange }: QuizFormEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromJson(value) ?? { titolo: '', domande: [] });
  const lastEmitted = useRef(value);

  // Se il contenuto cambia dall'esterno (es. modificato nel JSON o caricato dopo), riallinea la bozza.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const next = draftFromJson(value);
    if (next) setDraft(next);
    lastEmitted.current = value;
  }, [value]);

  const update = (next: Draft) => {
    setDraft(next);
    const json = draftToJson(next);
    lastEmitted.current = json;
    onChange(json);
  };

  const setQuestion = (index: number, patch: Partial<DraftQuestion>) =>
    update({
      ...draft,
      domande: draft.domande.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    });

  const moveQuestion = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draft.domande.length) return;
    const domande = [...draft.domande];
    [domande[index], domande[target]] = [domande[target], domande[index]];
    update({ ...draft, domande });
  };

  const duplicateQuestion = (index: number) => {
    const domande = [...draft.domande];
    domande.splice(index + 1, 0, {
      ...draft.domande[index],
      risposte: [...draft.domande[index].risposte],
      key: newKey(),
      id: nextId(draft.domande),
    });
    update({ ...draft, domande });
  };

  const removeQuestion = (index: number) => {
    const q = draft.domande[index];
    if (q.domanda.trim() && !window.confirm(`Eliminare la domanda ${index + 1}?`)) return;
    update({ ...draft, domande: draft.domande.filter((_, i) => i !== index) });
  };

  const addQuestion = () => update({ ...draft, domande: [...draft.domande, blankQuestion(nextId(draft.domande))] });

  const changeType = (index: number, tipo: QuizQuestionType) => {
    const q = draft.domande[index];
    if (tipo === q.tipo) return;
    if (tipo === 'vero_falso') {
      const current = q.risposte[q.corretta]?.trim().toLowerCase();
      setQuestion(index, {
        tipo,
        risposte: TRUE_FALSE,
        corretta: TRUE_FALSE.findIndex((o) => o.toLowerCase() === current),
      });
    } else {
      setQuestion(index, { tipo, risposte: [...TRUE_FALSE, '', ''] });
    }
  };

  const setAnswer = (qi: number, ai: number, text: string) =>
    setQuestion(qi, { risposte: draft.domande[qi].risposte.map((o, i) => (i === ai ? text : o)) });

  const removeAnswer = (qi: number, ai: number) => {
    const q = draft.domande[qi];
    setQuestion(qi, {
      risposte: q.risposte.filter((_, i) => i !== ai),
      corretta: q.corretta === ai ? -1 : q.corretta > ai ? q.corretta - 1 : q.corretta,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="quiz_titolo">Titolo del quiz (facoltativo)</Label>
        <Input
          id="quiz_titolo"
          value={draft.titolo}
          onChange={(e) => update({ ...draft, titolo: e.target.value })}
          placeholder="Es. Ripasso Lezione 1"
        />
      </div>

      {draft.domande.map((q, qi) => {
        const filled = q.risposte.filter((o) => o.trim()).length;
        const warning = !q.domanda.trim()
          ? 'Scrivi il testo della domanda.'
          : q.tipo === 'scelta_multipla' && filled < 2
            ? 'Servono almeno 2 risposte.'
            : q.corretta < 0 || !q.risposte[q.corretta]?.trim()
              ? 'Segna la risposta giusta.'
              : null;
        return (
          <div key={q.key} className={cn('rounded-lg border bg-card p-4 space-y-3', warning && 'border-amber-400')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Domanda {qi + 1}</span>
              <Select value={q.tipo} onValueChange={(t) => changeType(qi, t as QuizQuestionType)}>
                <SelectTrigger className="h-8 w-auto gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scelta_multipla">Scelta multipla</SelectItem>
                  <SelectItem value="vero_falso">Vero o falso</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Sposta su"
                  disabled={qi === 0} onClick={() => moveQuestion(qi, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Sposta giù"
                  disabled={qi === draft.domande.length - 1} onClick={() => moveQuestion(qi, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Duplica"
                  onClick={() => duplicateQuestion(qi)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Elimina"
                  onClick={() => removeQuestion(qi)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Textarea
              value={q.domanda}
              onChange={(e) => setQuestion(qi, { domanda: e.target.value })}
              placeholder="Scrivi qui la domanda…"
              rows={2}
            />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Clicca il cerchio accanto alla risposta giusta.</p>
              {q.risposte.map((answer, ai) => {
                const isCorrect = q.corretta === ai;
                return (
                  <div key={ai} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestion(qi, { corretta: ai })}
                      title={isCorrect ? 'Risposta giusta' : 'Segna come giusta'}
                      aria-pressed={isCorrect}
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        isCorrect
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-muted-foreground/40 hover:border-emerald-600',
                      )}
                    >
                      {isCorrect && <Check className="h-4 w-4" />}
                    </button>
                    {q.tipo === 'vero_falso' ? (
                      <span className={cn('text-sm', isCorrect && 'font-semibold text-emerald-700')}>{answer}</span>
                    ) : (
                      <>
                        <Input
                          value={answer}
                          onChange={(e) => setAnswer(qi, ai, e.target.value)}
                          placeholder={`Risposta ${String.fromCharCode(65 + ai)}`}
                          className={cn(isCorrect && 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30')}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          title="Rimuovi risposta" disabled={q.risposte.length <= 2}
                          onClick={() => removeAnswer(qi, ai)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
              {q.tipo === 'scelta_multipla' && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setQuestion(qi, { risposte: [...q.risposte, ''] })}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi risposta
                </Button>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Spiegazione (facoltativa, mostrata dopo la risposta)</Label>
              <Textarea
                value={q.spiegazione}
                onChange={(e) => setQuestion(qi, { spiegazione: e.target.value })}
                rows={2}
              />
            </div>

            {warning && <p className="text-xs text-amber-600">⚠️ {warning}</p>}
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Aggiungi domanda
      </Button>
    </div>
  );
}

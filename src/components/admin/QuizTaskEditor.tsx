import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { QuizTask } from '@/components/lesson/QuizTask';
import { parseQuizContent } from '@/lib/quiz';

interface QuizTaskEditorProps {
  value: string;
  onChange: (content: string) => void;
  courseId: string;
  currentTaskId?: string;
}

interface QuizTaskOption {
  id: string;
  label: string;
}

const EXAMPLE = JSON.stringify(
  {
    titolo: 'Ripasso Lezione 1',
    domande: [
      {
        id: 1,
        tipo: 'scelta_multipla',
        domanda: 'Scrivi qui la domanda?',
        risposte_possibili: ['Risposta A', 'Risposta B', 'Risposta C', 'Risposta D'],
        risposta_corretta: 'Risposta B',
        spiegazione: '(facoltativa) Mostrata dopo la risposta.',
      },
      {
        id: 2,
        tipo: 'vero_falso',
        domanda: 'Scrivi qui una frase vera o falsa.',
        risposte_possibili: ['Vero', 'Falso'],
        risposta_corretta: 'Vero',
      },
    ],
  },
  null,
  2,
);

export function QuizTaskEditor({ value, onChange, courseId, currentTaskId }: QuizTaskEditorProps) {
  const parsed = useMemo(() => parseQuizContent(value), [value]);
  const [mode, setMode] = useState<'json' | 'link'>(parsed.kind === 'ref' ? 'link' : 'json');
  const [showPreview, setShowPreview] = useState(false);
  const [quizTasks, setQuizTasks] = useState<QuizTaskOption[]>([]);
  // Tiene da parte il JSON scritto a mano se si passa a "collega" e poi si torna indietro.
  const [jsonDraft, setJsonDraft] = useState(parsed.kind === 'ref' ? '' : value);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('lesson_tasks')
        .select('id, title, task_number, content, lessons!inner(lesson_number, course_id)')
        .eq('content_type', 'quiz')
        .eq('lessons.course_id', courseId);
      const options = (data || [])
        .filter((t) => t.id !== currentTaskId && parseQuizContent(t.content).kind === 'quiz')
        .sort(
          (a, b) => a.lessons.lesson_number - b.lessons.lesson_number || a.task_number - b.task_number,
        )
        .map((t) => ({
          id: t.id,
          label: `Lezione ${t.lessons.lesson_number} · Task ${t.task_number}: ${t.title}`,
        }));
      setQuizTasks(options);
    };
    load();
  }, [courseId, currentTaskId]);

  const switchMode = (next: string) => {
    if (next === mode) return;
    if (next === 'link') {
      if (parsed.kind !== 'ref') setJsonDraft(value);
      onChange('');
    } else {
      onChange(jsonDraft);
    }
    setMode(next as 'json' | 'link');
  };

  const linkedId = parsed.kind === 'ref' ? parsed.taskId : '';

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="text-lg font-semibold">🧩 Quiz</h3>
        <p className="text-sm text-muted-foreground">
          Le risposte degli studenti non vengono salvate: restano solo nel loro browser. La task risulta completata
          quando finiscono il quiz.
        </p>
      </div>

      <Tabs value={mode} onValueChange={switchMode}>
        <TabsList>
          <TabsTrigger value="json">Scrivi le domande</TabsTrigger>
          <TabsTrigger value="link">Usa il quiz di un'altra task</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'link' ? (
        <div className="space-y-2">
          <Label>Quiz da mostrare</Label>
          <Select
            value={linkedId}
            onValueChange={(id) => onChange(JSON.stringify({ quiz_da_task: id }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={quizTasks.length ? 'Scegli un quiz del corso…' : 'Nessun quiz nel corso'} />
            </SelectTrigger>
            <SelectContent>
              {quizTasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Le domande restano scritte in un solo posto: se le modifichi nella task originale, cambiano anche qui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="quiz_json">Domande (JSON)</Label>
            {!value.trim() && (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(EXAMPLE)}>
                Inserisci esempio
              </Button>
            )}
          </div>
          <Textarea
            id="quiz_json"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={18}
            className="font-mono text-xs"
            placeholder={EXAMPLE}
          />
          <p className="text-xs text-muted-foreground">
            <code>tipo</code>: <code>scelta_multipla</code> o <code>vero_falso</code>. <code>risposta_corretta</code>{' '}
            deve essere uguale a una delle <code>risposte_possibili</code>. <code>spiegazione</code> è facoltativa. Le
            risposte a scelta multipla vengono mescolate per ogni studente.
          </p>
        </div>
      )}

      {parsed.kind === 'error' ? (
        value.trim() && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {parsed.message}
          </p>
        )
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {parsed.kind === 'quiz' ? `Quiz valido: ${parsed.quiz.domande.length} domande` : 'Quiz collegato'}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPreview ? 'Nascondi anteprima' : 'Anteprima'}
          </Button>
        </div>
      )}

      {showPreview && parsed.kind !== 'error' && (
        <QuizTask content={value} storageKey="admin-preview" teacherMode />
      )}
    </div>
  );
}

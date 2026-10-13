import { useState } from 'react';
import { FlaskConical, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TestCasesPanel } from '@/components/lesson/TestCasesPanel';
import {
  KIND_LABELS, PYTHON_KINDS, WEB_KINDS, newTestCaseId, parseTestCases, pythonCases, webCases,
  type EditableTestCase, type TestCase, type TestCaseKind, type TestResult,
} from '@/lib/testCases';
import { runPythonTests } from '@/lib/pythonTestRunner';
import { runWebTests } from '@/lib/webTestRunner';

export type TestMode = 'python' | 'web';

interface TestCasesEditorProps {
  mode: TestMode;
  value: EditableTestCase[];
  onChange: (cases: EditableTestCase[]) => void;
  // Codice di partenza, usato per la prova se non si incolla una soluzione
  starter: { python?: string; html?: string; css?: string; js?: string };
}

const str = (v: unknown) => (v == null ? '' : String(v));

export function TestCasesEditor({ mode, value, onChange, starter }: TestCasesEditorProps) {
  const kinds = mode === 'python' ? PYTHON_KINDS : WEB_KINDS;
  const visible = value.filter((c) => kinds.includes(c.kind));
  const [solution, setSolution] = useState('');
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [triedCases, setTriedCases] = useState<TestCase[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Record<string, unknown>) => {
    onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) => onChange(value.filter((c) => c.id !== id));
  const add = () => {
    const kind: TestCaseKind = mode === 'python' ? 'io' : 'dom-exists';
    onChange([...value, { id: newTestCaseId(), kind, name: `Test ${visible.length + 1}`, ...(kind === 'io' ? { match: 'trim' } : {}) }]);
  };

  const tryTests = async () => {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const parsed = parseTestCases(visible);
      if (mode === 'python') {
        const cases = pythonCases(parsed);
        setTriedCases(cases);
        setResults(await runPythonTests(solution.trim() ? solution : starter.python || '', cases));
      } else {
        const cases = webCases(parsed);
        setTriedCases(cases);
        const preview = solution.trim()
          ? { html: solution, css: '', js: '' }
          : { html: starter.html || '', css: starter.css || '', js: starter.js || '' };
        setResults((await runWebTests(preview, cases)).results);
      }
    } catch (e) {
      setError((e as Error)?.message || 'Impossibile eseguire i test');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="test-cases-editor">
      <div>
        <h4 className="text-md font-semibold flex items-center gap-2">
          <FlaskConical className="w-4 h-4" />
          Correzione automatica ({mode === 'python' ? 'Python' : 'Web'})
        </h4>
        <p className="text-sm text-muted-foreground">
          {mode === 'python'
            ? 'Ogni caso esegue il codice dello studente: "Input → output" confronta ciò che stampa con print() (i messaggi di input() non contano); "Assert" esegue un controllo dopo il codice, es. assert somma(2, 3) == 5.'
            : 'I casi controllano la pagina dello studente: elementi presenti, testi, numero di elementi, stili CSS calcolati o un\'espressione JavaScript che deve risultare vera.'}
          {' '}Lo studente vede i casi e preme "Verifica"; alla consegna di un compito la % di casi superati diventa il voto proposto.
        </p>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">Nessun caso di prova.</p>
      )}

      {visible.map((c, index) => (
        <div key={c.id} className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              aria-label={`Nome del caso ${index + 1}`}
              value={str(c.name)}
              onChange={(e) => update(c.id, { name: e.target.value })}
              placeholder="Nome del test"
              className="flex-1"
            />
            <Select value={c.kind} onValueChange={(kind) => update(c.id, { kind })}>
              <SelectTrigger className="sm:w-56" aria-label="Tipo di caso"><SelectValue /></SelectTrigger>
              <SelectContent>
                {kinds.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(c.id)} title="Elimina caso" className="text-destructive shrink-0">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {(c.kind === 'io' || c.kind === 'assert') && (
            <div className={c.kind === 'io' ? 'grid gap-3 md:grid-cols-2' : 'grid gap-3'}>
              {c.kind === 'assert' && (
                <div className="space-y-1">
                  <Label className="text-xs">Controllo (dopo il codice dello studente)</Label>
                  <Textarea rows={2} className="font-mono text-sm" value={str(c.code)} onChange={(e) => update(c.id, { code: e.target.value })} placeholder="assert somma(2, 3) == 5" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Input (una riga per ogni input(), facoltativo)</Label>
                <Textarea rows={2} className="font-mono text-sm" value={str(c.stdin)} onChange={(e) => update(c.id, { stdin: e.target.value })} placeholder={'Mario\n12'} />
              </div>
              {c.kind === 'io' && (
                <div className="space-y-1">
                  <Label className="text-xs">Output atteso</Label>
                  <Textarea rows={2} className="font-mono text-sm" value={str(c.expected)} onChange={(e) => update(c.id, { expected: e.target.value })} placeholder="Ciao Mario!" />
                  <Select value={str(c.match) || 'trim'} onValueChange={(match) => update(c.id, { match })}>
                    <SelectTrigger className="h-8 text-xs" aria-label="Confronto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trim">Uguale (ignora spazi in fondo)</SelectItem>
                      <SelectItem value="exact">Identico</SelectItem>
                      <SelectItem value="contains">Contiene</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {mode === 'web' && c.kind !== 'js' && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Selettore CSS</Label>
                <Input className="font-mono text-sm" value={str(c.selector)} onChange={(e) => update(c.id, { selector: e.target.value })} placeholder="h1, #menu li, .card" />
              </div>
              {c.kind === 'dom-text' && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Il testo deve contenere</Label>
                  <Input value={str(c.contains)} onChange={(e) => update(c.id, { contains: e.target.value })} placeholder="Benvenuti" />
                </div>
              )}
              {c.kind === 'dom-count' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Almeno</Label>
                    <Input type="number" min={0} value={str(c.min ?? 1)} onChange={(e) => update(c.id, { min: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Al massimo (facoltativo)</Label>
                    <Input type="number" min={0} value={str(c.max)} onChange={(e) => update(c.id, { max: e.target.value })} />
                  </div>
                </>
              )}
              {c.kind === 'css' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Proprietà</Label>
                    <Input className="font-mono text-sm" value={str(c.property)} onChange={(e) => update(c.id, { property: e.target.value })} placeholder="color" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valore atteso</Label>
                    <Input className="font-mono text-sm" value={str(c.value)} onChange={(e) => update(c.id, { value: e.target.value })} placeholder="red" />
                  </div>
                </>
              )}
            </div>
          )}

          {c.kind === 'js' && (
            <div className="space-y-1">
              <Label className="text-xs">Espressione JavaScript (deve risultare vera)</Label>
              <Textarea rows={2} className="font-mono text-sm" value={str(c.expression)} onChange={(e) => update(c.id, { expression: e.target.value })} placeholder="typeof saluta === 'function' && saluta('Ada') === 'Ciao Ada'" />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Suggerimento se il test fallisce (facoltativo)</Label>
            <Input value={str(c.hint)} onChange={(e) => update(c.id, { hint: e.target.value })} placeholder="Ricordati di usare return" />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="w-4 h-4 mr-1" />
        Aggiungi caso
      </Button>

      {visible.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="test-solution">Prova i casi con una soluzione (non viene salvata)</Label>
          <Textarea
            id="test-solution"
            rows={5}
            className="font-mono text-sm"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder={mode === 'python'
              ? 'Incolla qui la soluzione. Se vuoto si usa il codice predefinito.'
              : 'Incolla qui la soluzione HTML (con <style> e <script> se servono). Se vuoto si usa il codice predefinito.'}
          />
          <Button type="button" variant="secondary" size="sm" onClick={tryTests} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            Prova con la soluzione
          </Button>
          {(results || error) && (
            <TestCasesPanel cases={triedCases} results={results} error={error} className="rounded-lg border max-h-80" />
          )}
        </div>
      )}
    </div>
  );
}

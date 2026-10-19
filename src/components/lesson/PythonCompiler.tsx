import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Trash2, RotateCcw, Save, Check } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useCodeDraft } from '@/hooks/useCodeDraft';
import { CodeEditor } from './CodeEditor';
import { TestCasesPanel, TestSummary } from './TestCasesPanel';
import { useTestRunner } from '@/hooks/useTestRunner';
import { pythonCases, type TestCase, type TestResult } from '@/lib/testCases';
import { preloadPythonTests, runPythonTests } from '@/lib/pythonTestRunner';
import { explainPythonError, type FriendlyError as FriendlyErrorData } from '@/lib/friendlyErrors';
import { PYODIDE_INDEX_URL } from '@/lib/runtimes';
import { FriendlyError } from './FriendlyError';

declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<any>;
  }
}

export type TestRunnerRef = MutableRefObject<(() => Promise<TestResult[] | null>) | null>;

interface PythonCompilerProps {
  defaultCode?: string;
  taskId?: string;
  // Correzione automatica: casi di prova della task o del compito
  testCases?: TestCase[];
  onTestResults?: (results: TestResult[]) => void;
  // La pagina del compito lo usa per rieseguire i test alla consegna
  testRunnerRef?: TestRunnerRef;
}

const FALLBACK_CODE = '# Scrivi il tuo codice Python qui\nprint("Ciao, mondo!")\n';

// Preparato a ogni esecuzione: output catturato e input() con la finestra del browser.
// Compilato come "<techland>" (vedi runPython più sotto): così negli errori l'ultima
// riga "<exec>" del traceback è quella dell'alunno, anche se l'errore nasce qui dentro.
const RUN_PRELUDE = `
import sys, builtins
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()

def _js_input(prompt_text=""):
    from js import prompt as _js_prompt
    # Flush pending stdout to the browser output before showing the prompt
    pending = sys.stdout.getvalue()
    msg = str(prompt_text)
    if pending:
        msg = pending + msg
    result = _js_prompt(msg)
    if result is None:
        raise KeyboardInterrupt("Input annullato dall'utente")
    # Echo the input into stdout so it appears in the output panel
    print(str(prompt_text) + str(result))
    return str(result)

builtins.input = _js_input
`;

export function PythonCompiler({ defaultCode, taskId, testCases, onTestResults, testRunnerRef }: PythonCompilerProps) {
  const [output, setOutput] = useState<string>('');
  const [runError, setRunError] = useState<{ error: FriendlyErrorData; code: string } | null>(null);
  const [bottomTab, setBottomTab] = useState<'output' | 'tests'>('output');
  const [isLoadingPyodide, setIsLoadingPyodide] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const pyodideRef = useRef<any>(null);
  const { toast } = useToast();

  const effectiveDefaultCode = defaultCode || FALLBACK_CODE;

  const { code, setCode, isLoading: isLoadingDraft, isSaving, lastSaved, resetCode, saveDraft } = useCodeDraft({
    taskId,
    codeType: 'python',
    defaultCode: effectiveDefaultCode,
  });

  useEffect(() => {
    loadPyodide();
  }, []);

  const cases = pythonCases(testCases ?? []);
  const hasTests = cases.length > 0;
  const tests = useTestRunner(cases, (onResult) => runPythonTests(code, cases, onResult), onTestResults);

  useEffect(() => {
    if (hasTests) preloadPythonTests();
  }, [hasTests]);

  useEffect(() => {
    if (!testRunnerRef) return;
    testRunnerRef.current = hasTests ? tests.runTests : null;
    return () => { testRunnerRef.current = null; };
  }, [testRunnerRef, hasTests, tests.runTests]);

  const verify = () => {
    setBottomTab('tests');
    void tests.runTests();
  };

  const loadPyodide = async () => {
    try {
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = `${PYODIDE_INDEX_URL}pyodide.js`;
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide'));
        });
      }

      pyodideRef.current = await window.loadPyodide({
        indexURL: PYODIDE_INDEX_URL
      });

      setIsLoadingPyodide(false);
      setOutput('Python pronto! Clicca "Esegui" per eseguire il codice.');
    } catch (error) {
      console.error('Error loading Pyodide:', error);
      setOutput('Errore nel caricamento di Python. Ricarica la pagina.');
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile caricare Python',
      });
    }
  };

  const runCode = async () => {
    if (!pyodideRef.current || isRunning) return;

    setIsRunning(true);
    setRunError(null);
    setOutput('Esecuzione in corso...');

    try {
      pyodideRef.current.globals.set('_tl_src', RUN_PRELUDE);
      pyodideRef.current.runPython('exec(compile(_tl_src, "<techland>", "exec"))');

      await pyodideRef.current.runPythonAsync(code);

      const stdout = pyodideRef.current.runPython('sys.stdout.getvalue()');
      const stderr = pyodideRef.current.runPython('sys.stderr.getvalue()');

      if (stderr) {
        setOutput(`Output:\n${stdout}\n\nErrori:\n${stderr}`);
      } else {
        setOutput(stdout || '(Nessun output)');
      }
    } catch (error: any) {
      const message = String(error?.message ?? error);
      const friendly = explainPythonError(message, code);
      let printed = '';
      try { printed = pyodideRef.current.runPython('sys.stdout.getvalue()'); } catch { /* niente output */ }
      if (friendly) {
        setRunError({ error: friendly, code });
        setOutput(printed);
      } else {
        setOutput(`${printed ? `${printed}\n` : ''}Errore:\n${message}`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput('');
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    return lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🐍 Python</span>
          {isLoadingPyodide && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Caricamento...
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Salvataggio...
            </span>
          )}
          {!isSaving && lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              Salvato {formatLastSaved()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={saveDraft}
            disabled={isSaving}
            title="Salva codice"
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCode}
            title="Resetta codice"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          {hasTests && (
            <Button
              variant="outline"
              size="sm"
              onClick={verify}
              disabled={tests.running || isLoadingDraft}
              title="Controlla il codice con i casi di prova"
            >
              {tests.running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Verifica
            </Button>
          )}
          <Button
            size="sm"
            onClick={runCode}
            disabled={isLoadingPyodide || isRunning}
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Esegui
          </Button>
        </div>
      </div>

      {/* Resizable panels: Code editor + Output */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Code Editor Panel */}
        <ResizablePanel defaultSize={65} minSize={30}>
          <div className="h-full bg-muted overflow-hidden">
            {isLoadingDraft ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <CodeEditor
                code={code}
                onChange={setCode}
                language="python"
                className="h-full"
                placeholder="Scrivi il tuo codice Python..."
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Output Panel */}
        <ResizablePanel defaultSize={35} minSize={15}>
          <div className="h-full flex flex-col border-t border-border bg-muted/30">
            {hasTests && (
              <div className="flex items-center gap-1 px-2 pt-1 border-b border-border bg-muted/50" role="tablist">
                <button type="button" role="tab" aria-selected={bottomTab === 'output'} onClick={() => setBottomTab('output')}
                  className={`px-3 py-1 text-xs font-medium rounded-t ${bottomTab === 'output' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  Output
                </button>
                <button type="button" role="tab" aria-selected={bottomTab === 'tests'} onClick={() => setBottomTab('tests')}
                  className={`px-3 py-1 text-xs font-medium rounded-t flex items-center gap-1.5 ${bottomTab === 'tests' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  Test ({cases.length})
                  {!tests.running && <TestSummary cases={cases} results={tests.results} />}
                </button>
              </div>
            )}
            {hasTests && bottomTab === 'tests' ? (
              <TestCasesPanel
                className="flex-1"
                cases={cases}
                results={tests.results}
                running={tests.running}
                error={tests.error}
                onRun={verify}
                disabled={isLoadingDraft}
                code={code}
              />
            ) : (
              <>
                <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Output</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setOutput(''); setRunError(null); }}
                    title="Pulisci output"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="overflow-auto flex-1">
                  {output && (
                    <pre data-testid="python-output" className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap">
                      {output}
                    </pre>
                  )}
                  {runError && <FriendlyError error={runError.error} code={runError.code} className={output ? 'mx-4 mb-4' : 'm-4'} />}
                </div>
              </>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
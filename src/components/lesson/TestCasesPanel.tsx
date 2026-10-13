import { useState } from 'react';
import { CheckCircle2, ChevronDown, CircleDashed, FlaskConical, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { describeCase, type TestCase, type TestResult } from '@/lib/testCases';

interface TestCasesPanelProps {
  cases: TestCase[];
  results: TestResult[] | null;
  running?: boolean;
  error?: string | null;
  // Senza onRun il pannello è in sola lettura (vista insegnante)
  onRun?: () => void;
  disabled?: boolean;
  className?: string;
}

export function TestSummary({ cases, results }: { cases: TestCase[]; results: TestResult[] | null }) {
  if (!results || results.length < cases.length) return null;
  const passed = cases.filter((c) => results.find((r) => r.id === c.id)?.passed).length;
  const all = passed === cases.length;
  return (
    <span
      className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-full',
        all ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      )}
    >
      {passed}/{cases.length} test superati
    </span>
  );
}

export function TestCasesPanel({ cases, results, running, error, onRun, disabled, className }: TestCasesPanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allOk = !!results && results.length === cases.length && results.every((r) => r.passed);

  return (
    <div className={cn('flex flex-col min-h-0', className)} data-testid="test-cases-panel">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">Casi di prova</span>
          <TestSummary cases={cases} results={running ? null : results} />
        </div>
        {onRun && (
          <Button size="sm" onClick={onRun} disabled={running || disabled} className="h-7">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Verifica
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {error && <p className="text-sm text-destructive px-2 py-1">{error}</p>}
        {allOk && !running && onRun && (
          <p className="text-sm text-green-700 dark:text-green-300 px-2 py-1 font-medium">🎉 Tutti i test superati, ottimo lavoro!</p>
        )}
        {!results && !error && onRun && (
          <p className="text-xs text-muted-foreground px-2 py-1">Premi "Verifica" per controllare il tuo codice con questi casi.</p>
        )}
        <ul className="space-y-1.5">
          {cases.map((c) => {
            const r = results?.find((x) => x.id === c.id);
            const pending = running && !r;
            const failed = r && !r.passed;
            const expanded = open[c.id] ?? true;
            const hasDetails = !!failed;
            return (
              <li key={c.id} className={cn('rounded-md border text-sm', failed ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30' : r?.passed ? 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30' : 'border-border bg-background')}>
                <button
                  type="button"
                  className="w-full flex items-start gap-2 px-3 py-2 text-left"
                  onClick={() => hasDetails && setOpen((o) => ({ ...o, [c.id]: !expanded }))}
                  aria-expanded={hasDetails ? expanded : undefined}
                >
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    {pending ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : r?.passed ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : failed ? <XCircle className="w-4 h-4 text-red-600" />
                      : <CircleDashed className="w-4 h-4 text-muted-foreground" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="sr-only">{r ? (r.passed ? ' superato' : ' non superato') : ''}</span>
                    <span className="block text-xs text-muted-foreground font-mono truncate">{describeCase(c)}</span>
                  </span>
                  {hasDetails && <ChevronDown className={cn('w-4 h-4 mt-0.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />}
                </button>
                {hasDetails && expanded && r && (
                  <div className="px-3 pb-3 space-y-2 text-xs">
                    {r.error && <p className="font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap">{r.error}</p>}
                    {c.kind === 'io' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <div className="text-muted-foreground mb-0.5">Atteso</div>
                          <pre className="p-2 rounded bg-background border font-mono whitespace-pre-wrap">{c.expected || '(vuoto)'}</pre>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">Ottenuto</div>
                          <pre className="p-2 rounded bg-background border font-mono whitespace-pre-wrap">{r.actual || '(nessun output)'}</pre>
                        </div>
                      </div>
                    )}
                    {c.kind !== 'io' && r.actual && <p className="text-muted-foreground">Trovato: <span className="font-mono">{r.actual}</span></p>}
                    {c.hint && <p className="text-foreground">💡 {c.hint}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

import { Bot, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CodeViewer } from '@/components/admin/CodeViewer';
import { TestCasesPanel } from '@/components/lesson/TestCasesPanel';
import { parseSubmittedCode, parseTestCases, parseTestResults } from '@/lib/testCases';

function codeFileName(code: string): string {
  return code.startsWith('<!-- HTML -->') ? 'consegna.html' : 'consegna.py';
}

export function AutoScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  return (
    <Badge variant="outline" className="gap-1 border-primary/40 text-primary" title="Voto proposto dalla correzione automatica">
      <Bot className="w-3 h-3" />
      Auto {score}%
    </Badge>
  );
}

interface AutoGradingReviewProps {
  notes: string | null;
  autoScore: number | null;
  testResults: unknown;
  // homework.test_cases: servono nomi e descrizioni dei casi
  testCases: unknown;
}

/** Nel dialogo di valutazione: codice consegnato ed esito dei casi di prova. */
export function AutoGradingReview({ notes, autoScore, testResults, testCases }: AutoGradingReviewProps) {
  const code = parseSubmittedCode(notes);
  const results = parseTestResults(testResults);
  // Solo i casi di cui c'è un risultato: i casi Python non valgono per un compito Web e viceversa
  const cases = parseTestCases(testCases).filter((c) => results.some((r) => r.id === c.id));

  return (
    <>
      {code != null && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Codice inviato
          </Label>
          <CodeViewer code={code} fileName={codeFileName(code)} />
        </div>
      )}

      {autoScore != null && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Correzione automatica · voto proposto {autoScore}%
          </Label>
          {cases.length > 0 ? (
            <TestCasesPanel cases={cases} results={results} code={code ?? undefined} className="rounded-lg border max-h-72" />
          ) : (
            <p className="text-sm text-muted-foreground">I casi di prova sono stati modificati dopo la consegna: dettaglio non disponibile.</p>
          )}
        </div>
      )}
    </>
  );
}

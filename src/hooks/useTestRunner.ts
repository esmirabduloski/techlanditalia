import { useCallback, useEffect, useRef, useState } from 'react';
import type { TestCase, TestResult } from '@/lib/testCases';

export interface TestRunState {
  results: TestResult[] | null;
  running: boolean;
  error: string | null;
  runTests: () => Promise<TestResult[] | null>;
}

/**
 * Stato della verifica: `run` esegue i casi (Python nel worker, Web nell'iframe).
 * `onResults` avvisa la pagina (es. per sbloccare la task successiva).
 */
export function useTestRunner(
  cases: TestCase[],
  run: (onResult: (r: TestResult) => void) => Promise<TestResult[]>,
  onResults?: (results: TestResult[]) => void,
): TestRunState {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  const casesRef = useRef(cases);
  casesRef.current = cases;
  const casesKey = cases.map((c) => c.id).join('|');

  // Casi diversi (altra task): i risultati precedenti non valgono più
  useEffect(() => { setResults(null); setError(null); }, [casesKey]);

  const runTests = useCallback(async () => {
    if (casesRef.current.length === 0) return null;
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const partial: TestResult[] = [];
      const all = await runRef.current((r) => { partial.push(r); setResults([...partial]); });
      setResults(all);
      onResultsRef.current?.(all);
      return all;
    } catch (e) {
      setResults(null);
      setError((e as Error)?.message || 'Impossibile eseguire i test');
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { results, running, error, runTests };
}

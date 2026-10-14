import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import type { FriendlyError as FriendlyErrorData } from '@/lib/friendlyErrors';

// `nome` nel testo diventa codice
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code key={i} className="px-1 py-0.5 rounded bg-background/80 border font-mono text-[0.9em]">{part.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

interface FriendlyErrorProps {
  error: FriendlyErrorData;
  // Codice dello studente: serve a mostrare la riga sbagliata
  code?: string;
  compact?: boolean;
  className?: string;
}

export function FriendlyError({ error, code, compact, className }: FriendlyErrorProps) {
  const lineText = error.line && code ? code.split('\n')[error.line - 1] : undefined;

  return (
    <div
      role="alert"
      data-testid="friendly-error"
      className={cn(
        'rounded-md border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
        compact ? 'p-2 text-xs space-y-1' : 'p-3 text-sm space-y-1.5',
        className,
      )}
    >
      <p className="font-semibold">
        🤔 {error.title}
        {error.line && <span className="font-normal opacity-80"> · riga {error.line}</span>}
      </p>
      {lineText?.trim() && (
        <pre className="font-mono text-xs px-2 py-1 rounded bg-background/80 border overflow-x-auto">
          <span className="opacity-60 select-none">{error.line} │ </span>{lineText}
        </pre>
      )}
      <p><Rich text={error.explanation} /></p>
      {error.tip && <p>💡 <Rich text={error.tip} /></p>}
      <details className="text-xs opacity-80">
        <summary className="cursor-pointer select-none">Messaggio originale (in inglese)</summary>
        <p className="mt-1 font-mono whitespace-pre-wrap break-words">{error.original}</p>
      </details>
    </div>
  );
}

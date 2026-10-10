import { ChevronLeft, ChevronRight, EyeOff, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTaskTypeMeta } from '@/lib/lessonTheme';

export interface AdminStep {
  id: string;
  /** Numero mostrato nel pallino */
  number: number;
  title: string;
  contentType?: string | null;
  hidden?: boolean;
}

interface AdminStepperProps {
  steps: AdminStep[];
  /** id dell'elemento aperto; undefined quando se ne sta creando uno nuovo */
  currentId?: string;
  /** Nome dell'elemento per titoli e lettori di schermo: "Task", "Compito" */
  itemLabel: string;
  /** true mentre si salva prima di cambiare elemento */
  busy?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/**
 * Pallini numerati degli elementi della lezione (task, compiti), con la stessa
 * grafica che vedono gli alunni (LessonHeader), più Precedente/Successivo. Il
 * salvataggio prima del cambio lo fa chi usa il componente.
 */
export function AdminStepper({ steps, currentId, itemLabel, busy, onSelect, onNew }: AdminStepperProps) {
  const isNew = !currentId;
  // Un elemento nuovo sta in coda, dopo l'ultimo esistente
  const currentIndex = isNew ? steps.length : steps.findIndex(s => s.id === currentId);
  const previous = currentIndex > 0 ? steps[currentIndex - 1] : undefined;
  const next = !isNew && currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
  const noun = itemLabel.toLowerCase();

  return (
    <nav
      aria-label={`${itemLabel} della lezione`}
      className="tech-card p-3 mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4"
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => previous && onSelect(previous.id)}
        disabled={!previous || busy}
        aria-label={`${itemLabel} precedente`}
        title={`Salva e vai al ${noun} precedente`}
      >
        <ChevronLeft className="w-4 h-4 sm:mr-1" />
        <span className="hidden sm:inline">Precedente</span>
      </Button>

      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {steps.map((step) => {
          const current = step.id === currentId;
          // Il tipo (quiz, codice…) esiste solo per i task
          const type = step.contentType !== undefined ? getTaskTypeMeta(step.contentType) : null;
          const description = `${type ? ` · ${type.label}` : ''}: ${step.title}${step.hidden ? ' (nascosto)' : ''}`;
          return (
            <li key={step.id} className="relative">
              <button
                type="button"
                onClick={() => !current && onSelect(step.id)}
                disabled={busy}
                title={`${itemLabel} ${step.number}${description}`}
                aria-label={`${itemLabel} ${step.number}${description}`}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center border-2 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-wait',
                  current
                    ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-md'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  step.hidden && !current && 'border-dashed opacity-60',
                )}
              >
                {step.number}
              </button>
              {step.hidden ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-1.5 -right-1.5 bg-background rounded-full p-0.5 shadow-sm text-muted-foreground"
                >
                  <EyeOff className="w-2.5 h-2.5" />
                </span>
              ) : type && step.contentType && step.contentType !== 'text' && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-1.5 -right-1.5 text-[11px] leading-none bg-background rounded-full p-0.5 shadow-sm"
                >
                  {type.emoji}
                </span>
              )}
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => !isNew && onNew()}
            disabled={busy}
            title={`Nuovo ${noun}`}
            aria-label={`Nuovo ${noun}`}
            aria-current={isNew ? 'step' : undefined}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-wait',
              isNew
                ? 'bg-primary border-primary border-solid text-primary-foreground scale-110 shadow-md'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </li>
      </ol>

      <Button
        type="button"
        onClick={() => next && onSelect(next.id)}
        disabled={!next || busy}
        aria-label={`${itemLabel} successivo`}
        title={`Salva e vai al ${noun} successivo`}
      >
        <span className="hidden sm:inline">Successivo</span>
        {busy ? <Loader2 className="w-4 h-4 sm:ml-1 animate-spin" /> : <ChevronRight className="w-4 h-4 sm:ml-1" />}
      </Button>
    </nav>
  );
}

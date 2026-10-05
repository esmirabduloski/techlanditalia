import type { ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LessonStep {
  key: string;
  title: string;
  completed: boolean;
  current: boolean;
  onSelect: () => void;
}

interface LessonHeaderProps {
  courseTitle: string;
  lessonNumber: number;
  lessonTitle: string;
  /** Titolo del task corrente (se assente si mostra solo la lezione) */
  taskTitle?: string;
  /** Posizione del task tra quelli visibili, 1-based */
  taskPosition?: number;
  steps?: LessonStep[];
  onBack: () => void;
  onOpenOutline?: () => void;
  actions?: ReactNode;
  className?: string;
}

export function LessonHeader({
  courseTitle,
  lessonNumber,
  lessonTitle,
  taskTitle,
  taskPosition,
  steps = [],
  onBack,
  onOpenOutline,
  actions,
  className,
}: LessonHeaderProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <header className={cn('border-b border-border bg-background', className)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Torna al corso" className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Numero lezione ben visibile */}
        <div
          className="shrink-0 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex flex-col items-center justify-center leading-none shadow-sm"
          aria-hidden="true"
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Lez.</span>
          <span className="text-xl font-bold">{lessonNumber}</span>
        </div>

        <div className="flex-1 min-w-0">
          <nav aria-label="Percorso" className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <button type="button" onClick={onBack} className="hidden sm:inline truncate hover:text-foreground hover:underline">
              {courseTitle}
            </button>
            <ChevronRight className="hidden sm:inline w-3 h-3 shrink-0" />
            <span className="truncate">
              Lezione {lessonNumber}: {lessonTitle}
            </span>
          </nav>
          <h1 className="font-semibold text-base md:text-lg text-foreground leading-snug line-clamp-2 sm:line-clamp-1">
            {taskTitle ? (
              <>
                {taskPosition !== undefined && (
                  <span className="text-primary">Task {taskPosition} · </span>
                )}
                {taskTitle}
              </>
            ) : (
              lessonTitle
            )}
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {actions}
          {onOpenOutline && (
            <Button variant="outline" size="sm" onClick={onOpenOutline} aria-label="Apri sommario del corso">
              <ListTree className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Sommario</span>
            </Button>
          )}
        </div>
      </div>

      {steps.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3">
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Task della lezione">
            {steps.map((step, index) => (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={step.onSelect}
                  title={`Task ${index + 1}: ${step.title}`}
                  aria-label={`Task ${index + 1}: ${step.title}${step.completed ? ' (completato)' : ''}`}
                  aria-current={step.current ? 'step' : undefined}
                  className={cn(
                    'w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center border-2 transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    step.current
                      ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-md'
                      : step.completed
                        ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {step.completed && !step.current ? <Check className="w-4 h-4" /> : index + 1}
                </button>
              </li>
            ))}
          </ol>

          <div className="flex items-center gap-2 min-w-[140px] flex-1 max-w-xs">
            <div
              className="h-2 flex-1 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Avanzamento lezione"
            >
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedCount}/{steps.length} completati
            </span>
          </div>
        </div>
      )}
    </header>
  );
}

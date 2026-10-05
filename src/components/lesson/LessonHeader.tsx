import type { ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTaskTypeMeta } from '@/lib/lessonTheme';
import { CourseEmoji } from '@/components/ui/CourseEmoji';

export interface LessonStep {
  key: string;
  title: string;
  completed: boolean;
  current: boolean;
  contentType?: string | null;
  onSelect: () => void;
}

interface LessonHeaderProps {
  courseTitle: string;
  courseEmoji?: string;
  lessonNumber: number;
  lessonTitle: string;
  /** Titolo del task corrente (se assente si mostra solo la lezione) */
  taskTitle?: string;
  /** Posizione del task tra quelli visibili, 1-based */
  taskPosition?: number;
  taskType?: string | null;
  steps?: LessonStep[];
  /** Punti appena guadagnati: mostra un "+N" animato (cambiare `id` per ripeterlo) */
  pointsGained?: { id: number; points: number } | null;
  onBack: () => void;
  onOpenOutline?: () => void;
  actions?: ReactNode;
  className?: string;
}

export function LessonHeader({
  courseTitle,
  courseEmoji,
  lessonNumber,
  lessonTitle,
  taskTitle,
  taskPosition,
  taskType,
  steps = [],
  pointsGained,
  onBack,
  onOpenOutline,
  actions,
  className,
}: LessonHeaderProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const typeMeta = taskTitle ? getTaskTypeMeta(taskType) : null;

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
            <button type="button" onClick={onBack} className="hidden sm:inline-flex items-center gap-1 min-w-0 hover:text-foreground hover:underline">
              {courseEmoji && <CourseEmoji emoji={courseEmoji} size="sm" className="shrink-0" />}
              <span className="truncate">{courseTitle}</span>
            </button>
            <ChevronRight className="hidden sm:inline w-3 h-3 shrink-0" />
            <span className="truncate">
              Lezione {lessonNumber}: {lessonTitle}
            </span>
            {typeMeta && (
              <span className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                <span aria-hidden="true">{typeMeta.emoji}</span>
                {typeMeta.label}
              </span>
            )}
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
            {steps.map((step, index) => {
              const stepType = getTaskTypeMeta(step.contentType);
              return (
              <li key={step.key} className="relative">
                <button
                  type="button"
                  onClick={step.onSelect}
                  title={`Task ${index + 1} · ${stepType.label}: ${step.title}`}
                  aria-label={`Task ${index + 1}, ${stepType.label}: ${step.title}${step.completed ? ' (completato)' : ''}`}
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
                {step.contentType && step.contentType !== 'text' && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1.5 -right-1.5 text-[11px] leading-none bg-background rounded-full p-0.5 shadow-sm"
                  >
                    {stepType.emoji}
                  </span>
                )}
              </li>
              );
            })}
          </ol>

          <div className="relative flex items-center gap-2 min-w-[140px] flex-1 max-w-xs">
            {pointsGained && (
              <span
                key={pointsGained.id}
                role="status"
                className="animate-points-pop absolute -top-5 right-0 text-sm font-bold text-primary pointer-events-none"
              >
                +{pointsGained.points} punti ⚡
              </span>
            )}
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

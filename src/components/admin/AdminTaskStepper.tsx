import { ChevronLeft, ChevronRight, EyeOff, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTaskTypeMeta } from '@/lib/lessonTheme';

export interface AdminTaskStep {
  id: string;
  task_number: number;
  title: string;
  content_type: string | null;
  is_visible: boolean;
}

interface AdminTaskStepperProps {
  tasks: AdminTaskStep[];
  /** id del task aperto; undefined quando si sta creando un nuovo task */
  currentTaskId?: string;
  /** true mentre si salva prima di cambiare task */
  busy?: boolean;
  onSelect: (taskId: string) => void;
  onNew: () => void;
}

/**
 * Pallini numerati dei task della lezione, con la stessa grafica che vedono gli
 * alunni (LessonHeader), più Precedente/Successivo. Il salvataggio prima del
 * cambio task lo fa chi usa il componente.
 */
export function AdminTaskStepper({ tasks, currentTaskId, busy, onSelect, onNew }: AdminTaskStepperProps) {
  const isNew = !currentTaskId;
  // Un task nuovo sta in coda, dopo l'ultimo esistente
  const currentIndex = isNew ? tasks.length : tasks.findIndex(t => t.id === currentTaskId);
  const previous = currentIndex > 0 ? tasks[currentIndex - 1] : undefined;
  const next = !isNew && currentIndex >= 0 ? tasks[currentIndex + 1] : undefined;

  return (
    <nav
      aria-label="Task della lezione"
      className="tech-card p-3 mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4"
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => previous && onSelect(previous.id)}
        disabled={!previous || busy}
        aria-label="Task precedente"
        title="Salva e vai al task precedente"
      >
        <ChevronLeft className="w-4 h-4 sm:mr-1" />
        <span className="hidden sm:inline">Precedente</span>
      </Button>

      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {tasks.map((task) => {
          const current = task.id === currentTaskId;
          const type = getTaskTypeMeta(task.content_type);
          return (
            <li key={task.id} className="relative">
              <button
                type="button"
                onClick={() => !current && onSelect(task.id)}
                disabled={busy}
                title={`Task ${task.task_number} · ${type.label}: ${task.title}${task.is_visible ? '' : ' (nascosto)'}`}
                aria-label={`Task ${task.task_number}, ${type.label}: ${task.title}${task.is_visible ? '' : ' (nascosto)'}`}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center border-2 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-wait',
                  current
                    ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-md'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  !task.is_visible && !current && 'border-dashed opacity-60',
                )}
              >
                {task.task_number}
              </button>
              {!task.is_visible ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-1.5 -right-1.5 bg-background rounded-full p-0.5 shadow-sm text-muted-foreground"
                >
                  <EyeOff className="w-2.5 h-2.5" />
                </span>
              ) : task.content_type && task.content_type !== 'text' && (
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
            title="Nuovo task"
            aria-label="Nuovo task"
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
        aria-label="Task successivo"
        title="Salva e vai al task successivo"
      >
        <span className="hidden sm:inline">Successivo</span>
        {busy ? <Loader2 className="w-4 h-4 sm:ml-1 animate-spin" /> : <ChevronRight className="w-4 h-4 sm:ml-1" />}
      </Button>
    </nav>
  );
}

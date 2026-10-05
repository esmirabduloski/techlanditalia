import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TaskNavigationProps {
  courseId: string;
  lessonNumber: number;
  currentTaskNumber: number;
  totalTasks: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  basePath?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Barra di navigazione tra i task. È `sticky bottom-0`: resta visibile in fondo
 * allo schermo se è figlia diretta del contenitore che scorre.
 */
export function TaskNavigation({
  courseId,
  lessonNumber,
  currentTaskNumber,
  totalTasks,
  onPrevious,
  onNext,
  onComplete,
  basePath,
  disabled,
  className,
}: TaskNavigationProps) {
  const hasPrevious = currentTaskNumber > 1;
  const hasNext = currentTaskNumber < totalTasks;
  const base = basePath || `/area-riservata/corso/${courseId}`;

  return (
    <nav
      aria-label="Navigazione task"
      className={cn(
        'sticky bottom-0 z-10 py-3 mt-6 border-t border-border max-sm:pr-16',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2',
        className,
      )}
    >
      <div className="justify-self-start">
        {hasPrevious && (
          <Button variant="outline" onClick={onPrevious} asChild={!onPrevious} disabled={disabled} aria-label="Task precedente">
            {onPrevious ? (
              <>
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Precedente</span>
              </>
            ) : (
              <Link to={`${base}/lezione/${lessonNumber}/task/${currentTaskNumber - 1}`}>
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Precedente</span>
              </Link>
            )}
          </Button>
        )}
      </div>

      <div className="text-center leading-tight" aria-live="polite">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Lezione {lessonNumber}</div>
        <div className="text-sm font-semibold text-foreground">
          Task {currentTaskNumber} <span className="text-muted-foreground font-normal">di {totalTasks}</span>
        </div>
      </div>

      <div className="justify-self-end">
        {hasNext ? (
          <Button size="lg" onClick={onNext} asChild={!onNext} disabled={disabled} className="px-4 sm:px-6" aria-label="Task successivo">
            {onNext ? (
              <>
                <span className="hidden sm:inline">Successivo</span>
                <ChevronRight className="w-5 h-5 sm:ml-1" />
              </>
            ) : (
              <Link to={`${base}/lezione/${lessonNumber}/task/${currentTaskNumber + 1}`}>
                <span className="hidden sm:inline">Successivo</span>
                <ChevronRight className="w-5 h-5 sm:ml-1" />
              </Link>
            )}
          </Button>
        ) : (
          <Button size="lg" onClick={onComplete} disabled={disabled} className="px-4 sm:px-6" aria-label="Fine lezione">
            <CheckCircle2 className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Fine lezione</span>
          </Button>
        )}
      </div>
    </nav>
  );
}

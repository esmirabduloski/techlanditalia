import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface TaskNavigationProps {
  courseId: string;
  lessonNumber: number;
  currentTaskNumber: number;
  totalTasks: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
   basePath?: string;
}

export function TaskNavigation({
  courseId,
  lessonNumber,
  currentTaskNumber,
  totalTasks,
  onPrevious,
  onNext,
  onComplete,
   basePath,
}: TaskNavigationProps) {
  const hasPrevious = currentTaskNumber > 1;
  const hasNext = currentTaskNumber < totalTasks;
  const isLastTask = currentTaskNumber === totalTasks;
   const base = basePath || `/area-riservata/corso/${courseId}`;

  return (
    <div className="flex items-center justify-between py-4 border-t border-border">
      <div>
        {hasPrevious ? (
          <Button
            variant="outline"
            onClick={onPrevious}
            asChild={!onPrevious}
          >
            {onPrevious ? (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Task precedente
              </>
            ) : (
              <Link to={`${base}/lezione/${lessonNumber}/task/${currentTaskNumber - 1}`}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Task precedente
              </Link>
            )}
          </Button>
        ) : (
          <div />
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Task {currentTaskNumber} di {totalTasks}
      </div>

      <div>
        {hasNext ? (
          <Button
            onClick={onNext}
            asChild={!onNext}
          >
            {onNext ? (
              <>
                Task successivo
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <Link to={`${base}/lezione/${lessonNumber}/task/${currentTaskNumber + 1}`}>
                Task successivo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </Button>
        ) : (
          <Button onClick={onComplete}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Completa lezione
          </Button>
        )}
      </div>
    </div>
  );
}
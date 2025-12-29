import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface TaskNavigationProps {
  courseId: string;
  lessonNumber: number;
  currentTaskNumber: number;
  totalTasks: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function TaskNavigation({
  courseId,
  lessonNumber,
  currentTaskNumber,
  totalTasks,
  onPrevious,
  onNext,
}: TaskNavigationProps) {
  const hasPrevious = currentTaskNumber > 1;
  const hasNext = currentTaskNumber < totalTasks;

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
              <Link to={`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${currentTaskNumber - 1}`}>
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
              <Link to={`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${currentTaskNumber + 1}`}>
                Task successivo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link to={`/area-riservata/corso/${courseId}`}>
              Torna al corso
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
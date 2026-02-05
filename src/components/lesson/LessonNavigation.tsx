import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface LessonNavigationProps {
  courseId: string;
  currentLessonNumber: number;
  totalLessons: number;
  onPrevious?: () => void;
  onNext?: () => void;
   basePath?: string;
}

export function LessonNavigation({
  courseId,
  currentLessonNumber,
  totalLessons,
  onPrevious,
  onNext,
   basePath,
}: LessonNavigationProps) {
  const hasPrevious = currentLessonNumber > 1;
  const hasNext = currentLessonNumber < totalLessons;
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
                Lezione precedente
              </>
            ) : (
              <Link to={`${base}/lezione/${currentLessonNumber - 1}`}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Lezione precedente
              </Link>
            )}
          </Button>
        ) : (
          <div />
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Lezione {currentLessonNumber} di {totalLessons}
      </div>

      <div>
        {hasNext ? (
          <Button
            onClick={onNext}
            asChild={!onNext}
          >
            {onNext ? (
              <>
                Lezione successiva
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <Link to={`${base}/lezione/${currentLessonNumber + 1}`}>
                Lezione successiva
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link to={base}>
              Torna al corso
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

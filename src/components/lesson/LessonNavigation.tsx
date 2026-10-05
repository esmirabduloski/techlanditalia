import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LessonNavigationProps {
  courseId: string;
  currentLessonNumber: number;
  totalLessons: number;
  onPrevious?: () => void;
  onNext?: () => void;
  basePath?: string;
  className?: string;
}

/** Barra di navigazione tra le lezioni, `sticky bottom-0` come TaskNavigation. */
export function LessonNavigation({
  courseId,
  currentLessonNumber,
  totalLessons,
  onPrevious,
  onNext,
  basePath,
  className,
}: LessonNavigationProps) {
  const hasPrevious = currentLessonNumber > 1;
  const hasNext = currentLessonNumber < totalLessons;
  const base = basePath || `/area-riservata/corso/${courseId}`;

  return (
    <nav
      aria-label="Navigazione lezioni"
      className={cn(
        'sticky bottom-0 z-10 py-3 mt-6 border-t border-border max-sm:pr-16',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2',
        className,
      )}
    >
      <div className="justify-self-start">
        {hasPrevious && (
          <Button variant="outline" onClick={onPrevious} asChild={!onPrevious} aria-label="Lezione precedente" title="Lezione precedente (tasto ←)">
            {onPrevious ? (
              <>
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Lezione precedente</span>
              </>
            ) : (
              <Link to={`${base}/lezione/${currentLessonNumber - 1}`}>
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Lezione precedente</span>
              </Link>
            )}
          </Button>
        )}
      </div>

      <div className="text-sm font-semibold text-foreground text-center" aria-live="polite">
        Lezione {currentLessonNumber} <span className="text-muted-foreground font-normal">di {totalLessons}</span>
      </div>

      <div className="justify-self-end">
        {hasNext ? (
          <Button size="lg" onClick={onNext} asChild={!onNext} className="px-4 sm:px-6" aria-label="Lezione successiva" title="Lezione successiva (tasto →)">
            {onNext ? (
              <>
                <span className="hidden sm:inline">Lezione successiva</span>
                <ChevronRight className="w-5 h-5 sm:ml-1" />
              </>
            ) : (
              <Link to={`${base}/lezione/${currentLessonNumber + 1}`}>
                <span className="hidden sm:inline">Lezione successiva</span>
                <ChevronRight className="w-5 h-5 sm:ml-1" />
              </Link>
            )}
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link to={base}>Torna al corso</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}

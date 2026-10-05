import { useState } from 'react';
import { ArrowRight, Loader2, Lock, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LessonAccess } from '@/hooks/useCourseOutline';
import { cn } from '@/lib/utils';

interface LessonCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonNumber: number;
  lessonTitle: string;
  pointsReward: number;
  /** Stato di sblocco della lezione corrente */
  lessonAccess?: LessonAccess;
  onCompleteLesson: () => Promise<boolean>;
  nextLesson?: { lesson_number: number; title: string; access?: LessonAccess };
  onGoToLesson: (lessonNumber: number) => void;
  onGoToCourse: () => void;
  /** Classe tema del corso (il dialog è in un portal, fuori dalla pagina) */
  className?: string;
}

export function LessonCompleteDialog({
  open,
  onOpenChange,
  lessonNumber,
  lessonTitle,
  pointsReward,
  lessonAccess,
  onCompleteLesson,
  nextLesson,
  onGoToLesson,
  onGoToCourse,
  className,
}: LessonCompleteDialogProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeFailed, setCompleteFailed] = useState(false);

  const lessonCompleted = !!lessonAccess?.completed;
  const canCompleteLesson = !lessonCompleted && !!lessonAccess?.canComplete;
  const nextAccessible = !!nextLesson?.access?.accessible;

  const handleComplete = async () => {
    setIsCompleting(true);
    setCompleteFailed(false);
    const ok = await onCompleteLesson();
    setIsCompleting(false);
    if (!ok) setCompleteFailed(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-md text-center', className)}>
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="text-5xl mb-2" aria-hidden="true">🎉</div>
          <DialogTitle className="text-2xl">
            {lessonCompleted ? `Lezione ${lessonNumber} completata!` : 'Hai finito tutti i task!'}
          </DialogTitle>
          <DialogDescription>
            Lezione {lessonNumber}: {lessonTitle}
          </DialogDescription>
        </DialogHeader>

        {lessonCompleted && pointsReward > 0 && (
          <p className="flex items-center justify-center gap-1 text-primary font-semibold">
            <Zap className="w-4 h-4" />
            +{pointsReward} punti
          </p>
        )}

        {canCompleteLesson && (
          <div className="space-y-2">
            <Button size="lg" className="w-full" onClick={handleComplete} disabled={isCompleting}>
              {isCompleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trophy className="w-4 h-4 mr-2" />
                  Completa la lezione{pointsReward > 0 ? ` (+${pointsReward} punti)` : ''}
                </>
              )}
            </Button>
            {completeFailed && (
              <p className="text-sm text-destructive">Non è stato possibile completare la lezione. Riprova.</p>
            )}
          </div>
        )}

        {nextLesson ? (
          nextAccessible ? (
            <Button
              size="lg"
              variant={canCompleteLesson ? 'outline' : 'default'}
              className="w-full"
              onClick={() => onGoToLesson(nextLesson.lesson_number)}
            >
              Vai alla lezione {nextLesson.lesson_number}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Lezione {nextLesson.lesson_number}
                {lessonCompleted && nextLesson.access?.scheduledDate
                  ? `: disponibile dal ${new Date(nextLesson.access.scheduledDate).toLocaleDateString('it-IT')}`
                  : lessonCompleted
                    ? ': ancora bloccata'
                    : ': si sblocca quando completi questa lezione'}
              </span>
            </div>
          )
        ) : (
          lessonCompleted && (
            <p className="font-medium text-foreground">🏆 Hai finito tutte le lezioni del corso!</p>
          )
        )}

        <DialogFooter className="sm:justify-center">
          <Button variant="ghost" onClick={onGoToCourse}>
            Torna al corso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

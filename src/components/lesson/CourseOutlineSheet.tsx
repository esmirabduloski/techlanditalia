import { Check, CheckCircle2, Circle, Lock } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { LessonAccess, OutlineLesson } from '@/hooks/useCourseOutline';

interface CourseOutlineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  lessons: OutlineLesson[];
  access: Record<string, LessonAccess>;
  currentLessonId: string;
  currentTaskId?: string;
  isTaskCompleted: (taskId: string) => boolean;
  onSelectLesson: (lessonNumber: number) => void;
  onSelectTask: (taskNumber: number) => void;
}

export function CourseOutlineSheet({
  open,
  onOpenChange,
  courseTitle,
  lessons,
  access,
  currentLessonId,
  currentTaskId,
  isTaskCompleted,
  onSelectLesson,
  onSelectTask,
}: CourseOutlineSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Sommario</SheetTitle>
          <SheetDescription>{courseTitle}</SheetDescription>
        </SheetHeader>

        <ol className="mt-6 space-y-2">
          {lessons.map(lesson => {
            const state = access[lesson.id];
            const isCurrent = lesson.id === currentLessonId;
            // La lezione corrente è sempre apribile (lo studente ci è già dentro)
            const canOpen = isCurrent || state?.accessible;

            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (isCurrent) return;
                    onSelectLesson(lesson.lesson_number);
                    onOpenChange(false);
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    isCurrent
                      ? 'border-primary bg-primary/5'
                      : canOpen
                        ? 'border-border hover:border-primary/50 hover:bg-muted/50'
                        : 'border-border opacity-60 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold',
                      state?.completed
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {state?.completed ? (
                      <Check className="w-4 h-4" />
                    ) : !canOpen ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      lesson.lesson_number
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-muted-foreground">Lezione {lesson.lesson_number}</span>
                    <span className="block font-medium text-foreground truncate">{lesson.title}</span>
                    {!canOpen && state?.isNext && state.scheduledDate && (
                      <span className="block text-xs text-muted-foreground">
                        Disponibile dal {new Date(state.scheduledDate).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </span>
                </button>

                {isCurrent && lesson.tasks.length > 0 && (
                  <ol className="mt-1 ml-7 border-l border-border pl-4 space-y-0.5">
                    {lesson.tasks.map((task, index) => {
                      const done = isTaskCompleted(task.id);
                      const active = task.id === currentTaskId;
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTask(task.task_number);
                              onOpenChange(false);
                            }}
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                              'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
                              active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/90',
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                            ) : (
                              <Circle className="w-4 h-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">
                              {index + 1}. {task.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

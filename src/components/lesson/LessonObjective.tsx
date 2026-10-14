import { cn } from '@/lib/utils';
import { formatObjective } from '@/lib/lessonObjective';

interface LessonObjectiveProps {
  objective?: string | null;
  /** banner: riquadro grande a inizio lezione; inline: riga compatta nell'header */
  variant?: 'banner' | 'inline';
  className?: string;
}

export function LessonObjective({ objective, variant = 'banner', className }: LessonObjectiveProps) {
  const text = formatObjective(objective);
  if (!text) return null;

  if (variant === 'inline') {
    return (
      <p
        className={cn('flex items-start sm:items-center gap-1 text-xs text-muted-foreground min-w-0', className)}
        title={text}
        data-testid="lesson-objective-inline"
      >
        <span aria-hidden="true">🎯</span>
        <span className="line-clamp-2 sm:line-clamp-none sm:truncate">{text}</span>
      </p>
    );
  }

  return (
    <div
      role="note"
      aria-label="Obiettivo della lezione"
      className={cn(
        'flex items-start gap-3 rounded-r-xl border-l-4 border-primary bg-primary/[0.08] px-4 py-3',
        className,
      )}
      data-testid="lesson-objective-banner"
    >
      <span className="text-2xl leading-none" aria-hidden="true">🎯</span>
      <p className="text-base md:text-lg font-semibold text-foreground leading-snug">{text}</p>
    </div>
  );
}

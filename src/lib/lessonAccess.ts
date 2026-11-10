export interface LessonAccess {
  completed: boolean;
  isNext: boolean;
  canComplete: boolean;
  accessible: boolean;
  scheduledDate?: string;
}

/** Stable ISO day in the school's timezone, independent of browser date formatting. */
export function lessonToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function computeLessonAccess(
  lessons: readonly { id: string; lesson_number: number }[],
  completedLessonIds: Set<string>,
  schedule: Record<number, string>,
  today = lessonToday(),
): Record<string, LessonAccess> {
  const result: Record<string, LessonAccess> = {};
  let allPreviousCompleted = true;
  for (const lesson of lessons) {
    const completed = completedLessonIds.has(lesson.id);
    const isNext = !completed && allPreviousCompleted;
    const scheduledDate = schedule[lesson.lesson_number];
    const dateReached = !!scheduledDate && today >= scheduledDate;
    result[lesson.id] = {
      completed, isNext, scheduledDate,
      canComplete: isNext && dateReached,
      // An unfinished earlier lesson must not prevent opening today's material.
      accessible: completed || dateReached,
    };
    if (!completed) allPreviousCompleted = false;
  }
  return result;
}
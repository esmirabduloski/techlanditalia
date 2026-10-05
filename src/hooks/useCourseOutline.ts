import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OutlineTask {
  id: string;
  lesson_id: string;
  task_number: number;
  title: string;
  content_type: string | null;
}

export interface OutlineLesson {
  id: string;
  lesson_number: number;
  title: string;
  points_reward: number;
  tasks: OutlineTask[];
}

export interface LessonAccess {
  completed: boolean;
  /** Prima lezione non completata con tutte le precedenti completate */
  isNext: boolean;
  /** isNext e data di calendario raggiunta: lo studente può completarla */
  canComplete: boolean;
  /** Apribile dallo studente (stessa regola della pagina corso) */
  accessible: boolean;
  scheduledDate?: string;
}

/**
 * Struttura del corso (lezioni + task visibili) e calendario del gruppo dello studente.
 * Usata dal sommario laterale e dalla schermata di fine lezione.
 */
export function useCourseOutline(
  courseId: string | undefined,
  userId: string | null | undefined,
  { includeHiddenTasks = false }: { includeHiddenTasks?: boolean } = {},
) {
  const [lessons, setLessons] = useState<OutlineLesson[]>([]);
  const [schedule, setSchedule] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;

    const fetchOutline = async () => {
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, points_reward')
        .eq('course_id', courseId)
        .order('lesson_number');

      const lessonIds = (lessonsData || []).map(l => l.id);
      let tasksData: OutlineTask[] = [];
      if (lessonIds.length > 0) {
        let query = supabase
          .from('lesson_tasks')
          .select('id, lesson_id, task_number, title, content_type')
          .in('lesson_id', lessonIds)
          .order('task_number');
        // L'insegnante vede anche i task nascosti agli studenti
        if (!includeHiddenTasks) query = query.eq('is_visible', true);
        const { data } = await query;
        tasksData = (data || []) as OutlineTask[];
      }

      if (cancelled) return;
      setLessons((lessonsData || []).map(l => ({
        ...l,
        tasks: tasksData.filter(t => t.lesson_id === l.id),
      })));
      setIsLoading(false);
    };

    fetchOutline();
    return () => { cancelled = true; };
  }, [courseId, includeHiddenTasks]);

  useEffect(() => {
    if (!courseId || !userId) return;
    let cancelled = false;

    const fetchSchedule = async () => {
      const { data: groups } = await supabase
        .from('student_groups')
        .select('id, group_students!inner(student_id)')
        .eq('course_id', courseId)
        .eq('group_students.student_id', userId);
      const groupIds = (groups || []).map(g => g.id);
      if (groupIds.length === 0) {
        if (!cancelled) setSchedule({});
        return;
      }
      const { data: sched } = await supabase
        .from('group_lesson_schedule')
        .select('lesson_number, lesson_date')
        .in('group_id', groupIds);
      const map: Record<number, string> = {};
      (sched || []).forEach(s => {
        if (!map[s.lesson_number] || s.lesson_date < map[s.lesson_number]) {
          map[s.lesson_number] = s.lesson_date;
        }
      });
      if (!cancelled) setSchedule(map);
    };

    fetchSchedule();
    return () => { cancelled = true; };
  }, [courseId, userId]);

  return { lessons, schedule, isLoading };
}

/** Stessa regola di sblocco usata in CourseProgress. */
export function computeLessonAccess(
  lessons: OutlineLesson[],
  completedLessonIds: Set<string>,
  schedule: Record<number, string>,
): Record<string, LessonAccess> {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD locale
  const result: Record<string, LessonAccess> = {};
  let allPreviousCompleted = true;

  for (const lesson of lessons) {
    const completed = completedLessonIds.has(lesson.id);
    const isNext = !completed && allPreviousCompleted;
    const scheduledDate = schedule[lesson.lesson_number];
    const canComplete = isNext && !!scheduledDate && todayStr >= scheduledDate;
    result[lesson.id] = {
      completed,
      isNext,
      canComplete,
      accessible: completed || canComplete,
      scheduledDate,
    };
    if (!completed) allPreviousCompleted = false;
  }

  return result;
}

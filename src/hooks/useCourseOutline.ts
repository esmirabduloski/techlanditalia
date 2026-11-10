import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLessonSchedule } from '@/hooks/useLessonSchedule';
export { computeLessonAccess } from '@/lib/lessonAccess';
export type { LessonAccess } from '@/lib/lessonAccess';

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
  const { schedule, unlockAll } = useLessonSchedule(courseId, userId);
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

  return { lessons, schedule, unlockAll, isLoading };
}


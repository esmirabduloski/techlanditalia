import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

export function useAutoBackup() {
  const { user } = useAuth();

  const createCourseSnapshot = useCallback(async (courseId: string, label: string = 'Auto-backup prima di modifica') => {
    try {
      // Check if an auto-backup already exists for this course in the last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('content_snapshots')
        .select('id')
        .eq('entity_id', courseId)
        .eq('entity_type', 'course')
        .gte('created_at', fiveMinAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        // Skip if a recent backup exists (avoid flooding)
        return true;
      }

      const [courseRes, lessonsRes, tasksRes, homeworkRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number'),
        supabase.from('lesson_tasks').select('*, lessons!inner(course_id)').eq('lessons.course_id', courseId),
        supabase.from('homework').select('*, lessons!inner(course_id)').eq('lessons.course_id', courseId),
      ]);

      if (!courseRes.data) return false;

      const snapshotData = {
        course: courseRes.data,
        lessons: lessonsRes.data || [],
        tasks: tasksRes.data || [],
        homework: homeworkRes.data || [],
      };

      const { error } = await supabase.from('content_snapshots').insert({
        entity_type: 'course',
        entity_id: courseId,
        entity_label: courseRes.data.title,
        snapshot_label: label,
        snapshot_data: snapshotData,
        created_by: user?.id,
      });

      return !error;
    } catch {
      return false;
    }
  }, [user]);

  const backupAllCourses = useCallback(async () => {
    const { data: courses } = await supabase.from('courses').select('id, title').order('title');
    if (!courses) return { success: 0, total: 0 };

    let success = 0;
    for (const course of courses) {
      const ok = await createCourseSnapshot(course.id, `Backup iniziale - ${new Date().toLocaleString('it-IT')}`);
      if (ok) success++;
    }
    return { success, total: courses.length };
  }, [createCourseSnapshot]);

  return { createCourseSnapshot, backupAllCourses };
}

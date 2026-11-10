import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSiteSetting } from '@/hooks/useSiteSetting';

/** Shared calendar lookup: never infer dates from enrolment or unrelated groups. */
export function useLessonSchedule(courseId: string | undefined, userId: string | null | undefined) {
  const [schedule, setSchedule] = useState<Record<number, string>>({});
  const { value: override } = useSiteSetting<{ unlockAll?: boolean }>('lesson_access_override', {});

  useEffect(() => {
    let cancelled = false;
    setSchedule({});
    if (!courseId || !userId) return;
    async function load() {
      if (!courseId || !userId) return;
      const { data: memberships, error: membershipError } = await supabase
        .from('group_students').select('group_id').eq('student_id', userId);
      if (membershipError) { console.error('Lesson memberships unavailable', membershipError); return; }
      const ids = (memberships || []).map(m => m.group_id);
      if (!ids.length) return;
      const { data: groups, error: groupError } = await supabase
        .from('student_groups').select('id').eq('course_id', courseId).in('id', ids);
      if (groupError) { console.error('Lesson groups unavailable', groupError); return; }
      const groupIds = (groups || []).map(g => g.id);
      if (!groupIds.length) return;
      const { data, error } = await supabase.from('group_lesson_schedule')
        .select('lesson_number, lesson_date').in('group_id', groupIds);
      if (error) { console.error('Lesson calendar unavailable', error); return; }
      const map: Record<number, string> = {};
      for (const row of data || []) {
        if (!map[row.lesson_number] || row.lesson_date < map[row.lesson_number]) map[row.lesson_number] = row.lesson_date;
      }
      if (!cancelled) setSchedule(map);
    }
    void load();
    return () => { cancelled = true; };
  }, [courseId, userId]);

  return { schedule, unlockAll: override?.unlockAll === true };
}
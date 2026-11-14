import { useEffect, useState } from 'react';
import { fetchCourseTutorials, hasTutorialContent } from '@/lib/courseTutorials';

/** Id dei corsi (tra quelli indicati) che hanno un tutorial "come consegnare i compiti". */
export function useCourseTutorialIds(courseIds: string[]): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const key = [...courseIds].sort().join(',');

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(',') : [];
    fetchCourseTutorials(list).then((tutorials) => {
      if (!cancelled) setIds(new Set(tutorials.filter(hasTutorialContent).map((t) => t.course_id)));
    });
    return () => { cancelled = true; };
  }, [key]);

  return ids;
}

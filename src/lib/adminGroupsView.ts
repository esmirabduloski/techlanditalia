// Filtri e testi della pagina Admin → Gruppi.

export type GroupStatusFilter = 'active' | 'archived' | 'all';

export interface GroupListItem {
  title: string;
  status: string;
  teacher_name?: string;
  course_title?: string;
}

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Gruppi per stato e ricerca su nome del gruppo, insegnante o corso (senza accenti e maiuscole). */
export function filterGroups<T extends GroupListItem>(groups: T[], status: GroupStatusFilter, query: string): T[] {
  const q = normalize(query);
  return groups.filter(g => {
    if (status === 'active' && g.status !== 'active') return false;
    if (status === 'archived' && g.status === 'active') return false;
    if (!q) return true;
    return [g.title, g.teacher_name, g.course_title].some(v => v && normalize(v).includes(q));
  });
}

export function countByStatus(groups: GroupListItem[]): Record<GroupStatusFilter, number> {
  const active = groups.filter(g => g.status === 'active').length;
  return { active, archived: groups.length - active, all: groups.length };
}

/** "Lun, Mer · 17:00": giorni e orario delle lezioni. */
export function formatSchedule(lessonDays: number[] | null | undefined, lessonTime: string | null | undefined): string {
  const days = [...new Set(lessonDays ?? [])]
    .filter(d => d >= 0 && d <= 6)
    // Da lunedì a domenica
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map(d => DAY_SHORT[d]);
  const time = lessonTime ? lessonTime.substring(0, 5) : '';
  return [days.join(', '), time].filter(Boolean).join(' · ') || '-';
}

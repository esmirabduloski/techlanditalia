// Studenti di un gruppo (Admin → Gruppi): cosa aggiungere e togliere al
// salvataggio e chi è già in un altro gruppo dello stesso corso (il database
// lo rifiuta: trigger check_student_course_uniqueness).

export interface Membership {
  student_id: string;
  group_id: string;
  course_id: string | null;
  group_title: string;
  group_status: string;
}

export interface MembershipConflict {
  group_title: string;
  archived: boolean;
}

export function planMembershipChanges(current: string[], selected: string[]) {
  const cur = new Set(current);
  const sel = new Set(selected);
  return {
    toAdd: [...sel].filter(id => !cur.has(id)),
    toRemove: [...cur].filter(id => !sel.has(id)),
  };
}

/** Studenti già in un altro gruppo del corso scelto (gruppo in modifica escluso). */
export function findConflicts(
  memberships: Membership[],
  courseId: string,
  groupId: string | null,
): Map<string, MembershipConflict> {
  const out = new Map<string, MembershipConflict>();
  if (!courseId) return out;
  for (const m of memberships) {
    if (m.course_id !== courseId || m.group_id === groupId || out.has(m.student_id)) continue;
    out.set(m.student_id, { group_title: m.group_title, archived: m.group_status !== 'active' });
  }
  return out;
}

export function conflictLabel(c: MembershipConflict): string {
  return `già nel gruppo "${c.group_title}"${c.archived ? ' (archiviato)' : ''} di questo corso`;
}

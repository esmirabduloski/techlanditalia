// Studenti di un gruppo (Admin → Gruppi): cosa aggiungere e togliere al
// salvataggio e chi è già in un altro gruppo ATTIVO dello stesso corso (il
// database lo rifiuta: trigger check_student_course_uniqueness, 0084). Uno
// studente può stare in più gruppi di corsi diversi; i gruppi archiviati non
// contano.

export interface Membership {
  student_id: string;
  group_id: string;
  course_id: string | null;
  group_title: string;
  group_status: string;
}

export interface MembershipConflict {
  group_title: string;
}

export function planMembershipChanges(current: string[], selected: string[]) {
  const cur = new Set(current);
  const sel = new Set(selected);
  return {
    toAdd: [...sel].filter(id => !cur.has(id)),
    toRemove: [...cur].filter(id => !sel.has(id)),
  };
}

/**
 * Studenti già in un altro gruppo attivo del corso scelto (gruppo in modifica
 * escluso). Se il gruppo che si salva è archiviato non c'è nessun conflitto.
 */
export function findConflicts(
  memberships: Membership[],
  courseId: string,
  groupId: string | null,
  groupIsActive = true,
): Map<string, MembershipConflict> {
  const out = new Map<string, MembershipConflict>();
  if (!courseId || !groupIsActive) return out;
  for (const m of memberships) {
    if (m.course_id !== courseId || m.group_id === groupId || m.group_status !== 'active' || out.has(m.student_id)) continue;
    out.set(m.student_id, { group_title: m.group_title });
  }
  return out;
}

export function conflictLabel(c: MembershipConflict): string {
  return `già nel gruppo attivo "${c.group_title}" di questo corso`;
}

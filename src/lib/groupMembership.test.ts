import { describe, expect, it } from 'vitest';
import { conflictLabel, findConflicts, planMembershipChanges } from './groupMembership';

describe('planMembershipChanges', () => {
  it('aggiunge e toglie solo le differenze', () => {
    expect(planMembershipChanges(['a', 'b'], ['b', 'c'])).toEqual({ toAdd: ['c'], toRemove: ['a'] });
    expect(planMembershipChanges([], ['a', 'a'])).toEqual({ toAdd: ['a'], toRemove: [] });
    expect(planMembershipChanges(['a'], ['a'])).toEqual({ toAdd: [], toRemove: [] });
  });
});

describe('findConflicts', () => {
  const memberships = [
    { student_id: 's1', group_id: 'g1', course_id: 'roblox', group_title: 'Roblox-001', group_status: 'archived' },
    { student_id: 's2', group_id: 'g3', course_id: 'roblox', group_title: 'Roblox-003', group_status: 'active' },
    { student_id: 's3', group_id: 'g9', course_id: 'python', group_title: 'Python-001', group_status: 'active' },
  ];
  it('trova chi è in un altro gruppo dello stesso corso, anche archiviato', () => {
    const c = findConflicts(memberships, 'roblox', 'g3');
    expect([...c.keys()]).toEqual(['s1']);
    expect(conflictLabel(c.get('s1')!)).toBe('già nel gruppo "Roblox-001" (archiviato) di questo corso');
  });
  it('nuovo gruppo: conta anche gli altri gruppi attivi; altri corsi no', () => {
    expect([...findConflicts(memberships, 'roblox', null).keys()]).toEqual(['s1', 's2']);
    expect(findConflicts(memberships, 'scratch', null).size).toBe(0);
    expect(findConflicts(memberships, '', null).size).toBe(0);
  });
});

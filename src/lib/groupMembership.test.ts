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
    { student_id: 's2', group_id: 'g2', course_id: 'roblox', group_title: 'Roblox-002', group_status: 'active' },
    { student_id: 's3', group_id: 'g9', course_id: 'python', group_title: 'Python-001', group_status: 'active' },
  ];
  it('conta solo gli altri gruppi attivi dello stesso corso', () => {
    const c = findConflicts(memberships, 'roblox', 'g3');
    expect([...c.keys()]).toEqual(['s2']);
    expect(conflictLabel(c.get('s2')!)).toBe('già nel gruppo attivo "Roblox-002" di questo corso');
  });
  it('il gruppo stesso, altri corsi e gruppi archiviati non bloccano', () => {
    expect(findConflicts(memberships, 'roblox', 'g2').size).toBe(0);
    expect(findConflicts(memberships, 'scratch', null).size).toBe(0);
    expect(findConflicts(memberships, '', null).size).toBe(0);
    expect(findConflicts(memberships, 'roblox', 'g3', false).size).toBe(0);
  });
});

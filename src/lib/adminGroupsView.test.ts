import { describe, expect, it } from 'vitest';
import { countByStatus, filterGroups, formatSchedule } from './adminGroupsView';

const groups = [
  { title: 'Python Junior', status: 'active', teacher_name: 'Mirko Rossi', course_title: 'Python' },
  { title: 'Roblox Sabato', status: 'archived', teacher_name: 'Elena Bianchi', course_title: 'Roblox Studio' },
  { title: 'Web Città', status: 'active', teacher_name: undefined, course_title: 'Web' },
];

describe('filterGroups', () => {
  it('filtra per stato', () => {
    expect(filterGroups(groups, 'active', '').map(g => g.title)).toEqual(['Python Junior', 'Web Città']);
    expect(filterGroups(groups, 'archived', '').map(g => g.title)).toEqual(['Roblox Sabato']);
    expect(filterGroups(groups, 'all', '')).toHaveLength(3);
  });
  it('cerca in gruppo, insegnante e corso, senza accenti e maiuscole', () => {
    expect(filterGroups(groups, 'all', 'mirko').map(g => g.title)).toEqual(['Python Junior']);
    expect(filterGroups(groups, 'all', 'studio').map(g => g.title)).toEqual(['Roblox Sabato']);
    expect(filterGroups(groups, 'all', 'citta').map(g => g.title)).toEqual(['Web Città']);
    expect(filterGroups(groups, 'active', 'roblox')).toEqual([]);
  });
});

describe('countByStatus', () => {
  it('conta attivi, archiviati e tutti', () => {
    expect(countByStatus(groups)).toEqual({ active: 2, archived: 1, all: 3 });
  });
});

describe('formatSchedule', () => {
  it('giorni da lunedì a domenica e orario', () => {
    expect(formatSchedule([3, 0, 1], '17:00:00')).toBe('Lun, Mer, Dom · 17:00');
    expect(formatSchedule([6], null)).toBe('Sab');
    expect(formatSchedule([], '18:30')).toBe('18:30');
    expect(formatSchedule(null, null)).toBe('-');
  });
});

import { describe, expect, it } from 'vitest';
import { computeLessonAccess, lessonToday } from './lessonAccess';

const lessons = [1, 2, 3].map(n => ({ id: `lesson-${n}`, lesson_number: n }));
const schedule = { 1: '2026-11-03', 2: '2026-11-10', 3: '2026-11-17' };
const today = '2026-11-10';

describe('lesson access by scheduled date', () => {
  it('opens the November 10 lesson even when November 3 is unfinished', () => {
    expect(computeLessonAccess(lessons, new Set(), schedule, today)['lesson-2'].accessible).toBe(true);
  });
  it('does not open November 17 when the previous lesson is completed', () => {
    expect(computeLessonAccess(lessons, new Set(['lesson-1', 'lesson-2']), schedule, today)['lesson-3'].accessible).toBe(false);
  });
  it('keeps completion sequential without allowing future completion', () => {
    const access = computeLessonAccess(lessons, new Set(['lesson-1']), schedule, today);
    expect(access['lesson-2'].canComplete).toBe(true);
    expect(access['lesson-3'].canComplete).toBe(false);
    expect(computeLessonAccess(lessons, new Set(), schedule, today)['lesson-2'].canComplete).toBe(false);
  });
  it('keeps completed lessons open for review', () => {
    expect(computeLessonAccess(lessons, new Set(['lesson-1']), {}, today)['lesson-1'].accessible).toBe(true);
  });
  it('does not invent an unlock date when no calendar exists', () => {
    expect(computeLessonAccess(lessons, new Set(), {}, today)['lesson-1'].accessible).toBe(false);
  });
  it('uses the Italian day around midnight and the daylight saving change', () => {
    expect(lessonToday(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
    expect(lessonToday(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
  });
});
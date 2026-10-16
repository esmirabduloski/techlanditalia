import { describe, expect, it } from 'vitest';
import { attendanceStats, attendanceStatus, homeworkCounts, homeworkStatus, localDateKey, nextLesson } from './childProgress';

const today = '2026-10-16';

describe('homeworkStatus', () => {
  it('senza compito', () => {
    expect(homeworkStatus({ hasHomework: false, lessonDate: '2026-10-01', today })).toBe('none');
  });

  it('consegnato o valutato vince sulla scadenza', () => {
    expect(homeworkStatus({ hasHomework: true, submission: { status: 'pending' }, dueDate: '2026-10-01', today })).toBe('submitted');
    expect(homeworkStatus({ hasHomework: true, submission: { status: 'graded' }, dueDate: '2026-10-01', today })).toBe('graded');
  });

  it('mancante solo a scadenza passata', () => {
    expect(homeworkStatus({ hasHomework: true, lessonDate: '2026-10-09', dueDate: '2026-10-15', today })).toBe('missing');
    // Lezione passata ma scadenza oggi: c'è ancora tempo
    expect(homeworkStatus({ hasHomework: true, lessonDate: '2026-10-09', dueDate: '2026-10-16', today })).toBe('pending');
    expect(homeworkStatus({ hasHomework: true, lessonDate: '2026-10-23', dueDate: '2026-10-30', today })).toBe('pending');
  });

  it('senza scadenza vale la data della lezione', () => {
    expect(homeworkStatus({ hasHomework: true, lessonDate: '2026-10-15', today })).toBe('missing');
    expect(homeworkStatus({ hasHomework: true, lessonDate: '2026-10-16', today })).toBe('pending');
    expect(homeworkStatus({ hasHomework: true, today })).toBe('pending');
  });

  it('accetta timestamp completi come scadenza', () => {
    expect(homeworkStatus({ hasHomework: true, dueDate: '2026-10-15T23:59:00+00:00', today })).toBe('missing');
  });
});

describe('attendanceStatus', () => {
  it('usa il registro quando c\'è', () => {
    expect(attendanceStatus('present', '2026-10-01', today)).toBe('present');
    expect(attendanceStatus('absent', '2026-10-01', today)).toBe('absent');
    expect(attendanceStatus('excused', '2026-10-01', today)).toBe('justified');
    expect(attendanceStatus('justified', '2026-10-01', today)).toBe('justified');
  });

  it('lezione di oggi non ancora registrata non è un\'assenza', () => {
    expect(attendanceStatus(null, '2026-10-16', today)).toBe('pending');
    expect(attendanceStatus(undefined, '2026-10-30', today)).toBe('pending');
    expect(attendanceStatus(null, '2026-10-15', today)).toBe('absent');
  });
});

describe('statistiche', () => {
  it('percentuale presenze sulle lezioni svolte', () => {
    expect(attendanceStats(['present', 'present', 'absent', 'justified', 'pending', 'pending'])).toEqual({
      total: 4, present: 2, absent: 1, justified: 1, percentage: 50,
    });
    expect(attendanceStats(['pending']).percentage).toBe(0);
  });

  it('conteggio compiti per stato', () => {
    expect(homeworkCounts(['none', 'pending', 'missing', 'missing', 'graded', 'submitted'])).toEqual({
      all: 5, pending: 1, submitted: 1, graded: 1, missing: 2,
    });
  });
});

describe('nextLesson', () => {
  it('prima lezione da oggi in poi', () => {
    const lessons = [{ lesson_date: '2026-10-23' }, { lesson_date: '2026-10-09' }, { lesson_date: '2026-10-16' }];
    expect(nextLesson(lessons, today)).toEqual({ lesson_date: '2026-10-16' });
    expect(nextLesson([{ lesson_date: '2026-10-01' }], today)).toBeNull();
  });

  it('localDateKey usa la data locale', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

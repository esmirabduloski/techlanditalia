import { describe, expect, it } from 'vitest';
import { npsBand, summarizeSurveys, surveyQuestion } from './satisfactionSurvey';

describe('summarizeSurveys', () => {
  it('NPS, media e tasso di risposta', () => {
    const s = summarizeSurveys([
      { kind: 'after_3_lessons', status: 'answered', score: 10 },
      { kind: 'after_3_lessons', status: 'answered', score: 9 },
      { kind: 'module_end', status: 'answered', score: 7 },
      { kind: 'module_end', status: 'answered', score: 4 },
      { kind: 'module_end', status: 'pending', score: null },
      { kind: 'module_end', status: 'skipped', score: null },
    ]);
    expect(s.sent).toBe(5);
    expect(s.answered).toBe(4);
    expect(s.responseRate).toBe(80);
    expect(s.average).toBe(7.5);
    expect(s.nps).toBe(25);
    expect(s.byKind.after_3_lessons).toEqual({ answered: 2, average: 9.5 });
  });

  it('senza risposte', () => {
    const s = summarizeSurveys([]);
    expect(s.nps).toBeNull();
    expect(s.average).toBeNull();
    expect(s.responseRate).toBe(0);
  });
});

describe('testi', () => {
  it('fasce NPS', () => {
    expect(npsBand(9)).toBe('promoter');
    expect(npsBand(8)).toBe('passive');
    expect(npsBand(6)).toBe('detractor');
  });

  it('domanda', () => {
    expect(surveyQuestion({ kind: 'after_3_lessons', module_title: null }, 'Luca')).toBe('Come sono andate le prime lezioni di Luca?');
    expect(surveyQuestion({ kind: 'module_end', module_title: 'Modulo 1' }, 'Luca')).toContain('«Modulo 1»');
  });
});

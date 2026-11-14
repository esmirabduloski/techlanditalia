import { describe, expect, it } from 'vitest';
import { COURSE_BUTTON_GREENS, courseButtonColor } from './courseButtonColor';

describe('courseButtonColor', () => {
  it('dà un verde diverso a ogni corso finché ce ne sono nella palette', () => {
    const colors = COURSE_BUTTON_GREENS.map((_, i) => courseButtonColor(i));
    expect(new Set(colors).size).toBe(COURSE_BUTTON_GREENS.length);
  });

  it('ricomincia dalla prima sfumatura dopo l\'ultima', () => {
    expect(courseButtonColor(COURSE_BUTTON_GREENS.length)).toBe(courseButtonColor(0));
  });

  it('resta nella palette anche con indici strani', () => {
    for (const i of [-1, 2.7, 1000]) {
      expect(COURSE_BUTTON_GREENS).toContain(courseButtonColor(i));
    }
  });

  it('usa solo verdi', () => {
    for (const cls of COURSE_BUTTON_GREENS) {
      expect(cls).toMatch(/^bg-(green|lime|emerald)-\d+ /);
    }
  });
});

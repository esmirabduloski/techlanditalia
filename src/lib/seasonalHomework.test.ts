import { describe, expect, it } from 'vitest';
import { groupHintText, groupLessonStatus, seasonalPrefill, seasonalTitle, suggestLesson, themeDraftError } from './seasonalHomework';

const halloween = { name: 'Halloween', emoji: '🎃', prompt: 'Crea una mappa, degli oggetti o un gioco a tema Halloween' };

describe('seasonalTitle / seasonalPrefill', () => {
  it('usa emoji e nome del tema', () => {
    expect(seasonalTitle(halloween)).toBe('🎃 Missione Halloween');
  });

  it('parte dalla richiesta standard', () => {
    const p = seasonalPrefill(halloween);
    expect(p.title).toBe('🎃 Missione Halloween');
    expect(p.description).toBe(halloween.prompt);
    expect(p.instructions).toBe(`<p>${halloween.prompt}</p>`);
  });

  it('divide i paragrafi ed esegue l\'escape dell\'HTML', () => {
    const p = seasonalPrefill({ ...halloween, prompt: 'Usa <b>zucche</b> & fantasmi\nanche pipistrelli\n\nPoi consegna' });
    expect(p.instructions).toBe('<p>Usa &lt;b&gt;zucche&lt;/b&gt; &amp; fantasmi<br>anche pipistrelli</p><p>Poi consegna</p>');
  });

  it('senza richiesta lascia le istruzioni vuote', () => {
    expect(seasonalPrefill({ ...halloween, prompt: '  ' }).instructions).toBe('');
  });
});

describe('themeDraftError', () => {
  const draft = { name: 'Pasqua', emoji: '🐣', prompt: '', period_hint: null };

  it('accetta un tema nuovo', () => {
    expect(themeDraftError(draft, [{ name: 'Halloween' }])).toBeNull();
  });

  it('rifiuta nome vuoto, troppo lungo o già usato', () => {
    expect(themeDraftError({ ...draft, name: '  ' }, [])).toMatch(/obbligatorio/);
    expect(themeDraftError({ ...draft, name: 'x'.repeat(41) }, [])).toMatch(/40 caratteri/);
    expect(themeDraftError({ ...draft, name: ' pasqua ' }, [{ name: 'Pasqua' }])).toMatch(/Esiste già/);
  });
});

describe('groupLessonStatus', () => {
  const rows = [
    { group_id: 'a', lesson_number: 4, lesson_date: '2026-10-13' },
    { group_id: 'a', lesson_number: 5, lesson_date: '2026-10-20' },
    { group_id: 'a', lesson_number: 6, lesson_date: '2026-10-27' },
    { group_id: 'a', lesson_number: 7, lesson_date: '2026-11-03' },
    { group_id: 'b', lesson_number: 2, lesson_date: '2026-10-22' },
    { group_id: 'b', lesson_number: 1, lesson_date: '2026-10-15' },
    { group_id: 'c', lesson_number: 1, lesson_date: '2026-11-05' },
  ];

  it('trova ultima lezione fatta (oggi compreso) e prossima', () => {
    const status = groupLessonStatus(rows, '2026-10-20');
    expect(status.get('a')).toEqual({
      groupId: 'a',
      last: { lesson_number: 5, lesson_date: '2026-10-20' },
      next: { lesson_number: 6, lesson_date: '2026-10-27' },
    });
    expect(status.get('b')?.last?.lesson_number).toBe(1);
    expect(status.get('b')?.next?.lesson_number).toBe(2);
    expect(status.get('c')?.last).toBeNull();
    expect(status.get('c')?.next?.lesson_number).toBe(1);
  });

  it('un gruppo a fine calendario non ha prossima lezione', () => {
    expect(groupLessonStatus(rows, '2026-12-01').get('a')?.next).toBeNull();
  });
});

describe('suggestLesson', () => {
  const st = (next: number | null, last: number | null = null) => ({
    groupId: String(Math.random()),
    next: next === null ? null : { lesson_number: next, lesson_date: '2026-10-27' },
    last: last === null ? null : { lesson_number: last, lesson_date: '2026-10-20' },
  });
  const all = [1, 2, 3, 4, 5, 6, 7, 8];

  it('sceglie la prossima lezione più comune', () => {
    expect(suggestLesson([st(6), st(6), st(3)], all)).toBe(6);
  });

  it('a parità sceglie la più bassa', () => {
    expect(suggestLesson([st(6), st(3)], all)).toBe(3);
  });

  it('senza lezioni future usa quella dopo l\'ultima fatta', () => {
    expect(suggestLesson([st(null, 4)], all)).toBe(5);
  });

  it('ignora numeri che il corso non ha e corsi senza gruppi', () => {
    expect(suggestLesson([st(null, 8)], all)).toBeNull();
    expect(suggestLesson([], all)).toBeNull();
  });
});

describe('groupHintText', () => {
  it('dice dove è il gruppo', () => {
    expect(groupHintText({
      groupId: 'a',
      title: 'Scratch - Lunedì',
      last: { lesson_number: 5, lesson_date: '2026-10-20' },
      next: { lesson_number: 6, lesson_date: '2026-10-27' },
    })).toBe('Scratch - Lunedì: fatta L5 il 20/10 · prossima L6 il 27/10');
  });

  it('gruppo non iniziato o a fine calendario', () => {
    expect(groupHintText({ groupId: 'b', title: 'B', last: null, next: null }))
      .toBe('B: non ancora iniziato · nessuna lezione in calendario');
  });
});

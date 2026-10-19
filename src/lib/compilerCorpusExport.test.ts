import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { attachmentUrlsToInline, buildCorpus, type HomeworkRow, type TaskRow } from './compilerCorpusExport';
import { PYODIDE_VERSION, SKULPT_VERSION } from './runtimes';

const lessons = (slug: string, lesson_number = 1) => ({ lesson_number, courses: { slug } });

const codice = {
  python_env: null,
  replit_url: null,
  default_python_code: null,
  default_html_code: null,
  default_css_code: null,
  default_js_code: null,
  test_cases: [],
  attachments: null,
};

const task = (over: Partial<TaskRow>): TaskRow => ({
  id: 't', title: 'Task', task_number: 1, content_type: 'mixed', is_visible: true, lessons: lessons('python-base'), ...codice, ...over,
});
const compito = (over: Partial<HomeworkRow>): HomeworkRow => ({
  id: 'h', title: 'Compito', preview_only: false, lessons: lessons('python-base'), ...codice, ...over,
});

describe('buildCorpus', () => {
  const data = new Date('2026-10-19T10:00:00Z');

  it('tiene solo task misti e compiti dei corsi con compilatore, con il compilatore giusto', () => {
    const corpus = buildCorpus(
      [
        task({ id: 'py', default_python_code: 'print(1)' }),
        task({ id: 'tu', default_python_code: 'import turtle', task_number: 2 }),
        task({ id: 'pg', python_env: 'pgzero', task_number: 3 }),
        task({ id: 'quiz', content_type: 'quiz' }),
        task({ id: 'scratch', lessons: lessons('scratch-junior') }),
        task({ id: 'web', lessons: lessons('web-development'), default_html_code: '<h1>x</h1>' }),
      ],
      [compito({ id: 'hw', lessons: lessons('web-development', 2), preview_only: true, attachments: [{ name: 'a.css', url: 'https://x/a.css', type: 'css' }] })],
      {},
      data,
    );
    expect(corpus.esportato_il).toBe('2026-10-19T10:00:00.000Z');
    expect(corpus.versioni).toEqual({ pyodide: PYODIDE_VERSION, skulpt: SKULPT_VERSION });
    expect(corpus.task.map((t) => [t.tipo, t.id, t.compilatore])).toEqual([
      ['task', 'py', 'python'],
      ['task', 'tu', 'turtle'],
      ['task', 'pg', 'pgzero'],
      ['task', 'web', 'web'],
      ['compito', 'hw', 'web'],
    ]);
    expect(corpus.task[4]).toMatchObject({ preview_only: true, lezione: 2, numero: null, allegati: [] });
  });

  it('inserisce il testo dei CSS/JS allegati e tiene le immagini come link', () => {
    const allegati = [
      { name: 'stile.css', url: 'https://x/stile.css', type: 'css' },
      { name: 'lib.js', url: 'https://x/lib.js', type: 'js' },
      { name: 'gatto.png', url: 'https://x/gatto.png', type: 'image' },
    ];
    const rows = [task({ id: 'web', lessons: lessons('web-development'), attachments: JSON.stringify(allegati) })];
    expect(attachmentUrlsToInline(rows)).toEqual(['https://x/stile.css', 'https://x/lib.js']);
    const corpus = buildCorpus(rows, [], { 'https://x/stile.css': 'body{}', 'https://x/lib.js': 'var a;' }, data);
    expect(corpus.task[0].allegati).toEqual([
      { ...allegati[0], contenuto: 'body{}' },
      { ...allegati[1], contenuto: 'var a;' },
      allegati[2],
    ]);
  });

  it('ordine stabile per corso, lezione e numero (diff leggibili tra due export)', () => {
    const corpus = buildCorpus(
      [
        task({ id: 'b', task_number: 2, lessons: lessons('python-base', 10) }),
        task({ id: 'a', task_number: 1, lessons: lessons('python-base', 10) }),
        task({ id: 'c', task_number: 5, lessons: lessons('python-base', 2) }),
      ],
      [],
      {},
      data,
    );
    expect(corpus.task.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('casi di prova non validi diventano una lista vuota, task nascosti restano (segnalati)', () => {
    const corpus = buildCorpus([task({ test_cases: { non: 'lista' }, is_visible: false })], [], {}, data);
    expect(corpus.task[0]).toMatchObject({ test_cases: [], visibile: false });
  });
});

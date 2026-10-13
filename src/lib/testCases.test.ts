import { describe, expect, it } from 'vitest';
import {
  allPassed, compareCssValue, compareOutput, failedTestsFeedback, parseTestCases, parseTestResults,
  pythonCases, scoreResults, webCases,
} from './testCases';
import { toTestResult } from './pythonTestRunner';
import { buildTestDocument } from './webTestRunner';

describe('parseTestCases', () => {
  it('accetta JSON stringa o array e scarta i casi incompleti', () => {
    const cases = parseTestCases(JSON.stringify([
      { id: 'a', name: 'Somma', kind: 'io', stdin: '2\n3', expected: '5' },
      { id: 'b', kind: 'io' }, // manca expected
      { id: 'c', kind: 'assert', code: 'assert f(1) == 2' },
      { id: 'd', kind: 'assert', code: '   ' },
      { id: 'e', kind: 'dom-exists', selector: 'h1' },
      { id: 'f', kind: 'boh' },
      null,
    ]));
    expect(cases.map((c) => c.id)).toEqual(['a', 'c', 'e']);
    expect(cases[0]).toMatchObject({ kind: 'io', match: 'trim', stdin: '2\n3', expected: '5', name: 'Somma' });
    expect(cases[1].name).toBe('Test 3');
  });

  it('restituisce [] per valori non validi', () => {
    expect(parseTestCases(null)).toEqual([]);
    expect(parseTestCases('{rotto')).toEqual([]);
    expect(parseTestCases({ kind: 'io' })).toEqual([]);
  });

  it('rende unici gli id duplicati e normalizza dom-count', () => {
    const cases = parseTestCases([
      { id: 'x', kind: 'dom-count', selector: 'li', min: '2', max: '' },
      { id: 'x', kind: 'dom-count', selector: 'p', min: -3, max: 4 },
    ]);
    expect(cases[0]).toMatchObject({ id: 'x', min: 2 });
    expect(cases[0]).not.toHaveProperty('max');
    expect(cases[1]).toMatchObject({ id: 'x-2', min: 0, max: 4 });
  });

  it('separa i casi Python da quelli Web', () => {
    const cases = parseTestCases([
      { id: '1', kind: 'io', expected: '' },
      { id: '2', kind: 'css', selector: 'h1', property: 'color', value: 'red' },
      { id: '3', kind: 'js', expression: 'true' },
    ]);
    expect(pythonCases(cases).map((c) => c.id)).toEqual(['1']);
    expect(webCases(cases).map((c) => c.id)).toEqual(['2', '3']);
  });
});

describe('compareOutput', () => {
  it('trim ignora spazi finali, \\r\\n e righe vuote in fondo', () => {
    expect(compareOutput('5  \r\nciao\n\n', '5\nciao', 'trim')).toBe(true);
    expect(compareOutput('6\n', '5', 'trim')).toBe(false);
  });

  it('exact tollera solo l\'a capo finale di print()', () => {
    expect(compareOutput('Ciao\n', 'Ciao', 'exact')).toBe(true);
    expect(compareOutput('Ciao \n', 'Ciao', 'exact')).toBe(false);
  });

  it('contains cerca il testo atteso nell\'output', () => {
    expect(compareOutput('Il risultato è 42\n', '42', 'contains')).toBe(true);
    expect(compareOutput('Il risultato è 41\n', '42', 'contains')).toBe(false);
  });
});

describe('punteggio e risultati', () => {
  it('scoreResults arrotonda la percentuale', () => {
    expect(scoreResults([])).toBe(0);
    expect(scoreResults([{ passed: true }, { passed: false }, { passed: true }])).toBe(67);
    expect(scoreResults([{ passed: true }])).toBe(100);
  });

  it('allPassed richiede un risultato superato per ogni caso', () => {
    const cases = parseTestCases([{ id: 'a', kind: 'assert', code: 'x' }, { id: 'b', kind: 'assert', code: 'y' }]);
    expect(allPassed(cases, null)).toBe(false);
    expect(allPassed(cases, [{ id: 'a', passed: true }])).toBe(false);
    expect(allPassed(cases, [{ id: 'a', passed: true }, { id: 'b', passed: true }])).toBe(true);
    expect(allPassed([], [])).toBe(false);
  });

  it('parseTestResults scarta le righe malformate', () => {
    expect(parseTestResults([{ id: 'a', passed: true, actual: 'ok' }, { passed: true }, 'x', { id: 'b' }]))
      .toEqual([{ id: 'a', passed: true, actual: 'ok' }, { id: 'b', passed: false }]);
    expect(parseTestResults(null)).toEqual([]);
  });

  it('compareCssValue ignora spazi e maiuscole', () => {
    expect(compareCssValue('rgb(255, 0, 0)', 'RGB(255,0,0)')).toBe(true);
    expect(compareCssValue('16px', '18px')).toBe(false);
  });

  it('failedTestsFeedback elenca i test da sistemare con i suggerimenti', () => {
    const cases = parseTestCases([
      { id: 'a', name: 'Saluto', kind: 'io', expected: 'Ciao' },
      { id: 'b', name: 'Somma', kind: 'assert', code: 'assert s(1,2)==3', hint: 'usa return' },
    ]);
    expect(failedTestsFeedback(cases, [{ id: 'a', passed: true }, { id: 'b', passed: false }]))
      .toBe('Test superati: 1/2.\nDa sistemare:\n• Somma (suggerimento: usa return)');
    expect(failedTestsFeedback(cases, [{ id: 'a', passed: true }, { id: 'b', passed: true }])).toContain('tutti i 2 test');
  });
});

describe('toTestResult (Python)', () => {
  const [io, as] = parseTestCases([
    { id: 'io', kind: 'io', expected: '5' },
    { id: 'as', kind: 'assert', code: 'assert True' },
  ]) as ReturnType<typeof pythonCases>;

  it('confronta l\'output dei casi io', () => {
    expect(toTestResult(io, { id: 'io', passed: null, actual: '5\n' })).toEqual({ id: 'io', passed: true, actual: '5\n' });
    expect(toTestResult(io, { id: 'io', passed: null, actual: '4\n' }).passed).toBe(false);
  });

  it('un errore Python fa fallire il caso', () => {
    expect(toTestResult(io, { id: 'io', passed: false, actual: '', error: 'NameError' })).toMatchObject({ passed: false, error: 'NameError' });
    expect(toTestResult(as, { id: 'as', passed: true }).passed).toBe(true);
  });
});

describe('buildTestDocument (Web)', () => {
  it('inserisce i casi nello script senza poter chiudere il tag', () => {
    const cases = webCases(parseTestCases([{ id: 'a', kind: 'dom-text', selector: 'p', contains: '</script><b>' }]));
    const doc = buildTestDocument({ html: '<p>ciao</p>', css: '', js: '' }, cases, 'n1');
    expect(doc).toContain('<p>ciao</p>');
    expect(doc).not.toContain('</script><b>');
    expect(doc).toContain('\\u003c/script>');
    expect(doc).toContain('techland-web-tests');
  });
});

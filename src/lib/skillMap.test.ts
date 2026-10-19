import { describe, expect, it } from 'vitest';
import {
  SKILL_CONCEPTS,
  buildSkillMap,
  conceptCoverage,
  conceptLevel,
  digcompSummary,
  evidenceText,
  nextStepText,
  normalizeConcepts,
  startedCount,
  suggestConcepts,
  type SkillEvidenceRow,
} from './skillMap';

function row(concept: string, overrides: Partial<SkillEvidenceRow> = {}): SkillEvidenceRow {
  return {
    concept,
    lessons_tagged: 6,
    lessons_met: 0,
    lessons_completed: 0,
    homework_scored: 0,
    homework_avg: null,
    last_activity: null,
    course_ids: ['c1'],
    teacher_level: null,
    teacher_note: null,
    assessed_at: null,
    assessed_by_name: null,
    ...overrides,
  };
}

describe('conceptLevel', () => {
  it('da scoprire senza lezioni incontrate', () => {
    expect(conceptLevel(row('cicli'))).toBe(0);
  });

  it('base con una lezione incontrata (anche solo presenza)', () => {
    expect(conceptLevel(row('cicli', { lessons_met: 1 }))).toBe(1);
  });

  it('intermedio: 2 lezioni completate e un compito da almeno 60', () => {
    expect(conceptLevel(row('cicli', { lessons_met: 2, lessons_completed: 2, homework_scored: 1, homework_avg: 60 }))).toBe(2);
    expect(conceptLevel(row('cicli', { lessons_met: 2, lessons_completed: 2, homework_scored: 1, homework_avg: 59.9 }))).toBe(1);
    expect(conceptLevel(row('cicli', { lessons_met: 3, lessons_completed: 1, homework_scored: 1, homework_avg: 90 }))).toBe(1);
    expect(conceptLevel(row('cicli', { lessons_met: 3, lessons_completed: 3, homework_scored: 0 }))).toBe(1);
  });

  it('avanzato: 4 lezioni completate e 2 compiti con media da almeno 80', () => {
    expect(conceptLevel(row('cicli', { lessons_met: 4, lessons_completed: 4, homework_scored: 2, homework_avg: 80 }))).toBe(3);
    expect(conceptLevel(row('cicli', { lessons_met: 4, lessons_completed: 4, homework_scored: 1, homework_avg: 100 }))).toBe(2);
    expect(conceptLevel(row('cicli', { lessons_met: 4, lessons_completed: 3, homework_scored: 2, homework_avg: 95 }))).toBe(2);
    expect(conceptLevel(row('cicli', { lessons_met: 4, lessons_completed: 4, homework_scored: 2, homework_avg: 79 }))).toBe(2);
  });
});

describe('buildSkillMap', () => {
  it('tiene solo i concetti dei corsi o valutati, in ordine di catalogo', () => {
    const map = buildSkillMap([
      row('cicli', { lessons_met: 1 }),
      row('variabili', { lessons_tagged: 0, teacher_level: 2 }),
      row('web', { lessons_tagged: 0 }),
      row('sconosciuto', { lessons_met: 3 }),
    ]);
    expect(map.map((e) => e.concept.id)).toEqual(['variabili', 'cicli']);
  });

  it('il livello dell’insegnante vince, anche se più basso o zero', () => {
    const [cicli] = buildSkillMap([row('cicli', { lessons_met: 4, lessons_completed: 4, homework_scored: 2, homework_avg: 90, teacher_level: 0 })]);
    expect(cicli.autoLevel).toBe(3);
    expect(cicli.level).toBe(0);
    expect(cicli.confirmed).toBe(true);
  });

  it('ignora livelli dell’insegnante fuori scala', () => {
    const [cicli] = buildSkillMap([row('cicli', { lessons_met: 1, teacher_level: 7 })]);
    expect(cicli.confirmed).toBe(false);
    expect(cicli.level).toBe(1);
  });

  it('con includeAll mostra tutto il catalogo', () => {
    const map = buildSkillMap([], { includeAll: true });
    expect(map).toHaveLength(SKILL_CONCEPTS.length);
    expect(map.every((e) => e.level === 0 && e.evidence === null)).toBe(true);
  });
});

describe('digcompSummary', () => {
  it('livello raggiunto da almeno metà dei concetti della competenza', () => {
    const map = buildSkillMap([
      row('variabili', { lessons_met: 2, lessons_completed: 2, homework_scored: 1, homework_avg: 70 }), // 2
      row('condizioni', { lessons_met: 2, lessons_completed: 2, homework_scored: 1, homework_avg: 70 }), // 2
      row('cicli', { lessons_met: 1 }), // 1
      row('funzioni'), // 0
      row('web', { lessons_met: 1 }), // 3.1 → 1
    ]);
    const summary = digcompSummary(map);
    expect(summary.map((s) => [s.competence.id, s.level, s.concepts])).toEqual([
      ['3.4', 2, 4],
      ['3.1', 1, 1],
    ]);
  });

  it('con meno della metà dei concetti avviati resta da scoprire', () => {
    const map = buildSkillMap([row('variabili', { lessons_met: 1 }), row('cicli'), row('condizioni')]);
    expect(digcompSummary(map)[0].level).toBe(0);
  });

  it('nella vista insegnante non contano i concetti fuori dai corsi', () => {
    const map = buildSkillMap([row('cicli', { lessons_met: 1 })], { includeAll: true });
    expect(digcompSummary(map)).toEqual([expect.objectContaining({ level: 1, concepts: 1 })]);
    expect(startedCount(map)).toBe(1);
  });
});

describe('testi di spiegazione', () => {
  it('evidenceText', () => {
    const [cicli] = buildSkillMap([row('cicli', { lessons_met: 3, lessons_completed: 1, homework_scored: 2, homework_avg: 72.5 })]);
    expect(evidenceText(cicli)).toBe('3 lezioni fatte su 6 dedicate a questo argomento, 1 completata sulla piattaforma, 2 compiti valutati (media 72,5).');
    const [solo] = buildSkillMap([row('cicli', { lessons_tagged: 0, teacher_level: 1 })]);
    expect(evidenceText(solo)).toMatch(/Nessuna lezione/);
  });

  it('nextStepText dice cosa manca', () => {
    const [base] = buildSkillMap([row('cicli', { lessons_met: 2, lessons_completed: 1 })]);
    expect(nextStepText(base)).toBe('Per arrivare al livello Intermedio: completare ancora 1 lezione sulla piattaforma e avere 1 altro compito valutato.');
    const [media] = buildSkillMap([row('cicli', { lessons_met: 2, lessons_completed: 2, homework_scored: 1, homework_avg: 50 })]);
    expect(nextStepText(media)).toBe('Per arrivare al livello Intermedio: portare la media dei compiti a 60 (ora 50).');
    const [top] = buildSkillMap([row('cicli', { lessons_met: 4, lessons_completed: 4, homework_scored: 2, homework_avg: 90 })]);
    expect(nextStepText(top)).toBeNull();
    const [confermato] = buildSkillMap([row('cicli', { lessons_met: 1, teacher_level: 2 })]);
    expect(nextStepText(confermato)).toBeNull();
  });
});

describe('suggestConcepts', () => {
  it('riconosce parole italiane', () => {
    expect(suggestConcepts('Oggi impariamo a usare le variabili e il blocco "ripeti 10 volte"')).toEqual(['variabili', 'cicli']);
    expect(suggestConcepts('Se il gatto tocca il bordo, allora rimbalza: le condizioni')).toEqual(['condizioni']);
  });

  it('riconosce il codice dentro l’HTML', () => {
    const html = '<p>Prova:</p><pre><code>def saluta(nome):\n    for i in range(3):\n        if nome:\n            print(nome)</code></pre>';
    expect(suggestConcepts(html)).toEqual(['condizioni', 'cicli', 'funzioni']);
  });

  it('non confonde "funziona" con le funzioni né "la classe" con le classi', () => {
    expect(suggestConcepts('Controlla che il gioco funziona e mostralo alla classe')).toEqual([]);
    expect(suggestConcepts('class Nemico:\n    def __init__(self):\n        self.vite = 3')).toEqual(['funzioni', 'oggetti']);
  });
});

describe('normalizeConcepts', () => {
  it('filtra, toglie i doppioni e ordina come il catalogo', () => {
    expect(normalizeConcepts(['cicli', 'boh', 'variabili', 'cicli', 3])).toEqual(['variabili', 'cicli']);
    expect(normalizeConcepts(null)).toEqual([]);
  });
});

describe('conceptCoverage', () => {
  it('conta le lezioni per concetto e quelle senza tag', () => {
    const coverage = conceptCoverage([{ concepts: ['cicli', 'variabili'] }, { concepts: ['cicli'] }, { concepts: [] }]);
    expect(coverage?.concepts.map((c) => [c.concept.id, c.lessons])).toEqual([['variabili', 1], ['cicli', 2]]);
    expect(coverage?.untagged).toBe(1);
  });

  it('null finché la colonna non esiste', () => {
    expect(conceptCoverage([{}, {}])).toBeNull();
    expect(conceptCoverage([])).toBeNull();
  });
});

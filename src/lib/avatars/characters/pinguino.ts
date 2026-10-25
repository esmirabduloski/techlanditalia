import { eyes, GOLD, GOLD_LIGHT, growthOf, lerp, ModelBuilder, pedestal, sparkles } from '../voxel';

const K = '#26272e';
const W = '#f6f6f2';
const GRAY = '#9aa0a8';
const BEAK = '#f39c34';
const RED = '#d63a3a';

/** Pinguino: dal pulcino grigio all'imperatore con corona e mantello. */
export function pinguino(level: number) {
  const m = new ModelBuilder();
  const g = growthOf(level);
  const chick = level <= 2;
  const back = chick ? GRAY : K;
  const belly = level === 3 ? '#e4e6ea' : chick ? '#c3c8cf' : W;

  const bodyH = lerp(6.5, 15, g);
  const bodyW = lerp(6.6, 10, g);
  const bodyD = lerp(5.6, 8, g);
  const footH = 0.8;

  // zampe arancioni e corpo a botte
  m.both('body', [2.2, footH, 3.2], [bodyW * 0.22, 0, 0.6], BEAK);
  m.add('body', [bodyW - 1.6, 1, bodyD - 1.6], [0, footH, 0], back);
  m.add('body', [bodyW, bodyH - 2, bodyD], [0, footH + 1, 0], back);
  m.add('body', [bodyW - 1.6, 1, bodyD - 1.6], [0, footH + bodyH - 1, 0], back);
  m.add('body', [bodyW - 2.4, bodyH - 2.6, 0.3], [0, footH + 1.2, bodyD / 2], belly);
  const top = footH + bodyH;

  // pinne
  const flipH = bodyH * 0.6;
  m.pair('armL', 'armR', [1, flipH, bodyD * 0.5], [bodyW / 2 + 0.4, top - 1.5 - flipH, 0], back);
  m.pivot('armL', [-(bodyW / 2 + 0.4), top - 1.5, 0]).pivot('armR', [bodyW / 2 + 0.4, top - 1.5, 0]);
  m.pose('armL', [0, 0, -0.2]).pose('armR', [0, 0, 0.2]);

  // testa con la maschera bianca e il becco
  const s = lerp(6.4, 7.4, g);
  m.add('head', [s, s, s], [0, top, 0], back);
  m.pivot('head', [0, top, 0]);
  const face = chick ? W : level === 3 ? '#e4e6ea' : W;
  m.add('head', [s - 1.6, s * 0.62, 0.3], [0, top + 0.6, s / 2], face);
  if (level === 2) m.add('head', [s + 0.1, 1.4, s + 0.1], [0, top + s - 1.4, 0], K);
  m.add('head', [1.8, 1, 1.6], [0, top + s * 0.28, s / 2 + 0.6], level >= 4 ? K : BEAK);
  m.add('head', [1.2, 0.5, 0.6], [0, top + s * 0.28, s / 2 + 1.6], level >= 4 ? BEAK : '#d9822a');
  eyes(m, { cy: top + s * 0.62, front: s / 2 + 0.3, gap: s * 0.44, w: lerp(1.3, 1.1, g), h: lerp(1.8, 1.5, g) });
  if (chick) {
    // piumino arruffato
    m.add('head', [1, 1.2, 1], [0.6, top + s, 0], GRAY, { rot: [0, 0, 0.3] });
    m.add('head', [0.8, 1, 0.8], [-0.4, top + s, 0.3], GRAY, { rot: [0, 0, -0.3] });
  }
  if (level >= 4) {
    // macchie gialle dell'imperatore
    m.both('head', [0.3, 2.4, 2], [s / 2 + 0.05, top, 0.6], '#ffc93c');
    m.add('body', [bodyW - 3, 1.6, 0.35], [0, top - 1.6, bodyD / 2 + 0.05], '#ffe08a');
  }
  if (level === 5) {
    m.add('body', [1, 1, 0.5], [0, top - 1.2, bodyD / 2 + 0.3], RED);
    m.both('body', [1.6, 1.4, 0.4], [1.1, top - 1.4, bodyD / 2 + 0.3], RED);
  }
  if (level >= 6) {
    // sciarpa a righe con un capo che pende
    m.add('body', [bodyW + 0.4, 1.6, bodyD + 0.4], [0, top - 1.4, 0], '#3a7bd5');
    m.add('body', [bodyW + 0.5, 0.5, bodyD + 0.5], [0, top - 0.9, 0], '#ffffff');
    m.add('body', [1.6, 4, 0.5], [bodyW * 0.22, top - 5, bodyD / 2 + 0.4], '#3a7bd5', { rot: [0, 0, 0.12] });
    m.add('body', [1.65, 0.5, 0.55], [bodyW * 0.22 + 0.2, top - 4, bodyD / 2 + 0.4], '#ffffff', { rot: [0, 0, 0.12] });
  }
  if (level >= 7) {
    // pesce nella pinna
    const x = bodyW / 2 + 0.4;
    const y = top - 1.5 - flipH;
    m.add('armR', [0.8, 1.4, 3.2], [x + 0.4, y - 0.4, 1.4], '#7fa6c9');
    m.add('armR', [0.6, 2, 1], [x + 0.4, y - 0.7, -0.4], '#5f86a8');
    m.add('armR', [0.2, 0.4, 0.4], [x + 0.85, y + 0.3, 2.4], K);
  }
  if (level >= 8) {
    // mantello, con il bordo d'ermellino all'imperatore
    const cape = level === 10 ? '#8e2bb8' : RED;
    m.add('body', [bodyW + 0.8, bodyH - 1, 0.5], [0, footH + 0.4, -bodyD / 2 - 0.3], cape);
    m.add('body', [bodyW + 1.2, 1.2, bodyD + 1.2], [0, top - 1.2, 0], level === 10 ? '#ffffff' : cape);
    if (level === 10) for (let i = 0; i < 4; i++) m.add('body', [0.4, 0.5, 0.2], [-3 + i * 2, top - 0.9, bodyD / 2 + 0.62], K);
  }
  if (level >= 9) {
    // scettro di ghiaccio
    const x = -(bodyW / 2 + 0.4);
    const y = top - 1.5 - flipH;
    m.add('armL', [0.7, 9, 0.7], [x - 0.3, y - 3, 1], level === 10 ? GOLD : '#bcd7ee');
    m.add('armL', [1.6, 1.6, 1.6], [x - 0.3, y + 6, 1], '#9ff0ff', { glow: true, rot: [0.6, 0.6, 0] });
  }
  if (level === 10) {
    // corona
    const y = top + s;
    m.add('head', [s - 1, 1.2, s - 1], [0, y - 0.3, 0], GOLD);
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [0, -1]]) {
      m.add('head', [1, 1.2, 1], [x * (s / 2 - 1), y + 0.9, z * (s / 2 - 1)], GOLD_LIGHT);
    }
    m.add('head', [0.8, 0.8, 0.3], [0, y + 0.1, s / 2 - 0.4], '#e23b6b', { glow: true });
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 9, 3, top + s + 2);
  return m.build();
}

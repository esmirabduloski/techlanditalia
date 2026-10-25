import { chain, quadruped } from '../anatomy';
import { eyes, lerp, ModelBuilder, pedestal, sparkles } from '../voxel';

const O = '#e8742a';
const W = '#f7efe6';
const K = '#2b2420';
const CYAN = '#2ad1e8';
const TAILS = [1, 1, 1, 1, 1, 2, 2, 3, 5, 7, 9];

/** Volpe Tech: da cucciolo dalle orecchie enormi a kitsune con nove code. */
export function volpe(level: number) {
  const m = new ModelBuilder(-0.85);
  const f = quadruped(m, level, { body: O, legs: K, hooves: K, head: O, snout: W, belly: W }, { lenScale: 0.9 });
  const { g } = f;

  // guance bianche, naso, orecchie grandi nei cuccioli
  m.add('head', [f.headW + 0.06, f.headH * 0.36, 1.8], [0, f.headY0, f.front - 0.85], W);
  m.add('head', [1.2, 0.8, 0.3], [0, f.headY0 + f.snoutH - 0.8, f.snoutFront], K);
  const ear = lerp(1.45, 1, g);
  for (const sx of [-1, 1]) {
    const x = sx * (f.headW / 2 - 1.1 * ear);
    m.add('head', [2.2 * ear, 1.8 * ear, 1.1], [x, f.headY0 + f.headH, f.headZ - 0.4], O);
    m.add('head', [1.2 * ear, 1.4 * ear, 0.9], [x, f.headY0 + f.headH + 1.8 * ear, f.headZ - 0.4], K);
    m.add('head', [1.1 * ear, 1.2 * ear, 0.2], [x, f.headY0 + f.headH + 0.2, f.headZ + 0.1], '#f6c7a8');
  }
  eyes(m, { cy: f.headY0 + f.headH * 0.66, front: f.front, gap: f.headW * 0.5, w: lerp(1.3, 1.1, g), h: lerp(1.8, 1.4, g) });

  // code a ventaglio: una, poi due, tre, cinque, sette, nove
  const n = TAILS[level];
  const len = lerp(3.6, 7, g);
  const w = lerp(2.2, 2.6, g);
  m.pivot('tail', [0, f.bodyTop - 1, f.backZ]);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const spread = t * Math.min(2.8, n * 0.45);
    const pitch = 0.3 + (0.5 - Math.abs(t)) * (n > 1 ? 1 : 0.5);
    const tip = level === 10 ? '#fff3b0' : W;
    chain(m, 'tail', [0, f.bodyTop - 1.2, f.backZ + 0.4], { pitch, spread }, [
      { len: len * 0.55, w, color: O },
      { len: len * 0.45, w: w * 1.1, color: O, pitch: pitch + 0.35 },
      { len: lerp(1.4, 1.8, g), w: w * 0.95, color: tip, pitch: pitch + 0.5, glow: level === 10 },
    ]);
  }

  if (level >= 3) {
    // collare con la medaglietta luminosa
    const y = f.legH + f.bodyH * 0.45;
    m.add('body', [f.bodyW + 0.3, 1.1, 1.4], [0, y, f.bodyLen / 2 - 0.6], CYAN);
    m.add('body', [1, 1, 0.3], [0, y - 1, f.bodyLen / 2 + 0.2], '#d8fbff', { glow: true });
  }
  if (level >= 4) {
    // cuffie tech
    const hy = f.headY0 + f.headH;
    m.add('head', [f.headW + 1.4, 0.7, 1], [0, hy, f.headZ - 1.4], '#3a3f4a');
    m.both('head', [1, 2.6, 2.6], [f.headW / 2 + 0.5, f.headY0 + f.headH * 0.35, f.headZ - 1.2], '#3a3f4a');
    m.both('head', [0.3, 1.4, 1.4], [f.headW / 2 + 1.05, f.headY0 + f.headH * 0.35 + 0.6, f.headZ - 1.2], CYAN, { glow: level >= 7 });
  }
  if (level >= 6) {
    // occhialini da esploratrice sulla fronte
    const y = f.headY0 + f.headH * 0.82;
    m.add('head', [f.headW + 0.12, 0.7, f.headD + 0.12], [0, y + 0.2, f.headZ], '#4a3a2e');
    m.both('head', [1.7, 1.3, 0.4], [f.headW * 0.24, y, f.front + 0.1], '#ffd166');
    m.both('head', [1.1, 0.8, 0.2], [f.headW * 0.24, y + 0.25, f.front + 0.3], '#8fe9ff', { glow: true });
  }
  if (level >= 9) {
    // segni tech luminosi sulle zampe
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        m.add('body', [0.15, 0.5, f.legW * 0.7], [sx * (f.legX + f.legW / 2 + 0.02), f.legH * 0.55, sz * f.legZ], CYAN, { glow: true });
      }
    }
  }

  pedestal(m, level, 12, 18);
  if (level === 10) sparkles(m, 8, 3, f.headY0 + f.headH + 4);
  return m.build();
}

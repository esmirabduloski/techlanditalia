import { holdStick, humanoid } from '../anatomy';
import { GOLD, GOLD_LIGHT, ModelBuilder, pedestal, sparkles } from '../voxel';

const W = '#f4f2ec';
const K = '#26252b';
const RED = '#d63a3a';
const BELTS = ['', '', '', '#ffffff', '#f2c230', '#f08a24', '#3fae5a', K, K, K, K];

/** Panda: da cucciolo a gran maestro di kung-fu, una cintura per livello. */
export function panda(level: number) {
  const m = new ModelBuilder();
  const f = humanoid(m, level, { skin: W, torso: W, legs: K, shoes: K, arms: K, hands: K });
  const s = f.headS;

  // fascia nera sulle spalle, orecchie, muso
  m.add('body', [f.torsoW + 0.04, f.torsoH * 0.32, f.torsoD + 0.04], [0, f.torsoTop - f.torsoH * 0.32, 0], K);
  m.both('head', [2.2, 2.2, 1.4], [s / 2 - 1, f.headTop - 0.8, -0.6], K);
  m.add('head', [s * 0.46, s * 0.26, 0.6], [0, f.headY0 + s * 0.1, f.front], '#ffffff');
  m.add('head', [1.5, 0.9, 0.3], [0, f.headY0 + s * 0.3, f.front + 0.55], K);
  m.add('head', [0.9, 0.35, 0.2], [0, f.headY0 + s * 0.14, f.front + 0.55], K);

  // macchie degli occhi con occhio bianco e pupilla
  const cy = f.headY0 + s * 0.55;
  const gap = s * 0.44;
  m.pivot('eyes', [0, cy, f.front]);
  for (const sx of [-1, 1]) {
    const x = sx * gap / 2;
    m.add('head', [2.4, 2.9, 0.2], [x, cy - 1.6, f.front + 0.05], K, { rot: [0, 0, sx * 0.25] });
    m.add('eyes', [1.1, 1.3, 0.2], [x + sx * 0.1, cy - 0.7, f.front + 0.2], '#ffffff');
    m.add('eyes', [0.6, 0.8, 0.2], [x + sx * 0.1, cy - 0.6, f.front + 0.3], K);
  }

  if (level >= 2 && level < 8) {
    // germoglio di bambù
    const st = holdStick(m, f, { len: 6, w: 0.7, color: '#6fbf3c' });
    m.add('armR', [0.8, 0.3, 0.8], [st.x, st.top - 2.4, st.z], '#4e9a2a');
    m.add('armR', [1.8, 0.3, 0.9], [st.x + 0.9, st.top - 1, st.z], '#5bb33a', { rot: [0, 0, 0.5] });
  }
  if (level >= 7) {
    // kimono con il collo a V e le maniche
    const gi = '#f1e7d0';
    m.add('body', [f.torsoW + 0.12, f.torsoH, f.torsoD + 0.12], [0, f.legH, 0], gi);
    for (const sx of [-1, 1]) {
      m.add('body', [0.6, f.torsoH * 0.62, 0.2], [sx * 1.1, f.torsoTop - f.torsoH * 0.62, f.torsoD / 2 + 0.12], '#c9b994', { rot: [0, 0, sx * 0.32] });
    }
    m.pair('armL', 'armR', [f.armW + 0.25, f.armLen * 0.5, f.armW + 0.25], [f.armX, f.shoulderY - f.armLen * 0.5, 0], gi);
  }
  if (level >= 3) {
    const belt = BELTS[level];
    const y = f.legH + 0.5;
    m.add('body', [f.torsoW + 0.24, 1, f.torsoD + 0.24], [0, y, 0], belt);
    m.add('body', [1.3, 1.1, 0.3], [0, y - 0.05, f.torsoD / 2 + 0.2], belt);
    m.add('body', [0.5, 1.8, 0.2], [-0.4, y - 1.5, f.torsoD / 2 + 0.3], belt, { rot: [0, 0, 0.2] });
    m.add('body', [0.5, 1.6, 0.2], [0.5, y - 1.4, f.torsoD / 2 + 0.3], belt, { rot: [0, 0, -0.25] });
    if (level === 10) m.add('body', [f.torsoW + 0.3, 0.25, f.torsoD + 0.3], [0, y + 0.4, 0], GOLD);
  }
  if (level >= 4) {
    // fascia rossa con le code dietro la testa
    m.add('head', [s + 0.15, 1, s + 0.15], [0, f.headY0 + s * 0.72, 0], RED);
    m.add('head', [0.8, 2.4, 0.3], [0.6, f.headY0 + s * 0.72 - 2, -s / 2 - 0.3], RED, { rot: [0.3, 0, 0.25] });
    m.add('head', [0.8, 2, 0.3], [-0.4, f.headY0 + s * 0.72 - 1.7, -s / 2 - 0.3], RED, { rot: [0.3, 0, -0.2] });
  }
  if (level >= 5) {
    m.pair('armL', 'armR', [f.armW + 0.2, 0.7, f.armW + 0.2], [f.armX, f.handY0 + 1.4, 0], RED);
  }
  if (level >= 8) {
    // bastone bō, d'oro al livello 10
    const staff = level === 10 ? GOLD : '#9cc25a';
    const st = holdStick(m, f, { len: 24, w: 0.8, color: staff, below: 0.3 });
    for (const y of [0.25, 0.55, 0.85]) m.add('armR', [0.95, 0.35, 0.95], [st.x, st.top - 24 + 24 * y, st.z], level === 10 ? GOLD_LIGHT : '#6f9a35');
    if (level === 10) {
      m.add('armR', [1.1, 1.1, 1.1], [st.x, st.top, st.z], '#fff3b0', { glow: true });
      m.add('armR', [1.1, 1.1, 1.1], [st.x, st.top - 25.1, st.z], '#fff3b0', { glow: true });
    }
  }
  if (level >= 9) {
    // cappello di paglia
    const hy = f.headTop - 0.5;
    m.add('head', [s + 5, 0.7, s + 5], [0, hy, 0], '#d9b56a');
    m.add('head', [s + 2, 0.9, s + 2], [0, hy + 0.7, 0], '#e3c27a');
    m.add('head', [s - 1.5, 0.9, s - 1.5], [0, hy + 1.6, 0], '#d9b56a');
    m.add('head', [2, 0.7, 2], [0, hy + 2.5, 0], '#cfa857');
    m.add('head', [s + 2.1, 0.35, s + 2.1], [0, hy + 0.7, 0], level === 10 ? GOLD : RED);
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 9, 4, f.headTop + 2);
  return m.build();
}

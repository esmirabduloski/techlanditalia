import { hair, holdStick, humanFace, humanoid } from '../anatomy';
import { eyes, GOLD, ModelBuilder, pedestal, sparkles } from '../voxel';

const SKIN = '#f3c6a0';
const ROBE = '#4b3fb0';
const ROBE_DARK = '#2c2470';
const STAR = '#ffe27a';
const CRYSTAL = '#7ff0ff';
// barba: lunghezza e colore per livello (sempre più lunga e più bianca)
const BEARD: [number, string][] = [[0, ''], [0, ''], [0, ''], [0, ''], [0, ''], [1.4, '#7a4a2a'], [2, '#8a6a52'], [2.8, '#9c9a98'], [3.8, '#c8c8cc'], [4.8, '#dedee4'], [7, '#f4f4f8']];

/** Cappello a punta: nel livello 1 è troppo grande e scende sugli occhi. */
function hat(m: ModelBuilder, y: number, s: number, k: number, gold: boolean) {
  m.add('head', [(s + 3) * k, 0.8, (s + 3) * k], [0, y, 0], ROBE);
  m.add('head', [(s + 0.4) * k, 2.6 * k, (s + 0.4) * k], [0, y + 0.8, 0], ROBE);
  m.add('head', [(s - 1.6) * k, 2.4 * k, (s - 1.6) * k], [0, y + 0.8 + 2.6 * k, 0.3], ROBE);
  m.add('head', [(s - 3.4) * k, 2 * k, (s - 3.4) * k], [0, y + 0.8 + 5 * k, 0.1], ROBE);
  m.add('head', [1.6, 1.6, 1.6], [0, y + 0.8 + 6.6 * k, -0.8], ROBE, { rot: [-0.5, 0, 0] });
  m.add('head', [(s + 0.5) * k, 0.7, (s + 0.5) * k], [0, y + 0.8, 0], gold ? GOLD : ROBE_DARK);
  return y + 0.8 + 2.6 * k;
}

/** Mago: dall'apprendista col cappello troppo grande all'arcimago. */
export function mago(level: number) {
  const m = new ModelBuilder();
  const robe = level >= 3;
  const f = humanoid(m, level, {
    skin: SKIN,
    torso: robe ? ROBE : '#8a5a3b',
    legs: robe ? ROBE : '#6b4a35',
    arms: robe ? ROBE : '#8a5a3b',
    shoes: '#4a3428',
  });
  const s = f.headS;
  hair(m, f, level >= 8 ? '#dedee4' : '#6b4226', { fringe: 1.2, back: 0.7 });
  const face = humanFace(m, f);
  const lv1 = level === 1;
  eyes(m, { cy: face.cy - (lv1 ? 0.4 : 0), front: f.front, gap: face.gap, w: face.w, h: lv1 ? 1.2 : face.h });

  const hatMid = hat(m, lv1 ? f.headTop - 2 : f.headTop - 0.6, s, lv1 ? 1.2 : 1, level === 10);
  if (level >= 5) {
    // stelle sul cappello e sulla tunica
    m.add('head', [0.9, 0.9, 0.2], [-1.2, hatMid + 0.6, (s - 1.6) / 2 + 0.4], STAR, { rot: [0, 0, 0.785] });
    m.add('head', [0.7, 0.7, 0.2], [1.4, hatMid - 1.4, (s + 0.4) / 2 + 0.05], STAR, { rot: [0, 0, 0.785] });
    for (const [x, y] of [[-1.8, 0.35], [1.6, 0.7], [0.9, 0.15]]) {
      m.add('body', [0.8, 0.8, 0.2], [x, f.legH + f.torsoH * y, f.torsoD / 2 + 0.1], STAR, { rot: [0, 0, 0.785] });
    }
  }
  if (robe) {
    // tunica lunga sopra le gambe
    m.add('body', [f.torsoW + 0.6, f.legH - 0.8, f.torsoD + 0.6], [0, 0.8, 0], ROBE);
    m.add('body', [f.torsoW + 0.7, 0.6, f.torsoD + 0.7], [0, 0.8, 0], level === 10 ? GOLD : ROBE_DARK);
    m.add('body', [f.torsoW + 0.2, 0.8, f.torsoD + 0.2], [0, f.legH + 0.4, 0], level === 10 ? GOLD : '#c79a3a');
  }
  if (level >= 6) {
    m.add('body', [f.torsoW + 1, f.torsoH + f.legH - 1.4, 0.5], [0, 1.4, -f.torsoD / 2 - 0.5], ROBE_DARK);
    m.both('body', [1.6, 0.8, f.torsoD + 1.2], [f.torsoW / 2 - 0.6, f.shoulderY - 0.4, -0.2], ROBE_DARK);
  }

  const [beardLen, beardColor] = BEARD[level];
  if (beardLen > 0) {
    m.add('head', [s * 0.64, beardLen, 1.2], [0, f.headY0 + s * 0.26 - beardLen, f.front - 0.4], beardColor);
    m.add('head', [s * 0.7, 1.4, 0.6], [0, f.headY0 + s * 0.12, f.front + 0.1], beardColor);
    m.add('head', [s * 0.5, 0.6, 0.3], [0, f.headY0 + s * 0.3, f.front + 0.15], beardColor);
  }

  if (level === 2 || level === 3) {
    const st = holdStick(m, f, { len: 4.5, w: 0.6, color: '#8b5a2b', below: 0.2 });
    m.add('armR', [1, 0.5, 0.6], [st.x + 0.5, st.top - 1.2, st.z], '#5bb33a', { rot: [0, 0, 0.5] });
  }
  if (level >= 4 && level < 8) {
    const st = holdStick(m, f, { len: 5, w: 0.6, color: '#2b2230', below: 0.2 });
    m.add('armR', [0.9, 0.9, 0.9], [st.x, st.top - 0.2, st.z], '#fff3b0', { glow: true });
  }
  if (level >= 7) {
    // libro degli incantesimi
    m.add('armL', [1.3, 3.4, 2.8], [-f.armX - 1.1, f.handY0 + 0.2, 0.4], '#a8322d');
    m.add('armL', [1.35, 3, 0.2], [-f.armX - 1.1, f.handY0 + 0.4, 1.75], '#f3e7c8');
    m.add('armL', [0.2, 0.8, 0.8], [-f.armX - 1.8, f.handY0 + 1.5, 0.4], GOLD);
  }
  if (level >= 8) {
    // bastone con il cristallo
    const st = holdStick(m, f, { len: 22, w: 1, color: '#7a5230', below: 0.3 });
    m.add('armR', [1.6, 1.2, 1.6], [st.x, st.top - 0.6, st.z], level === 10 ? GOLD : '#5d3d22');
    if (level >= 9) {
      const c = level === 10 ? 2.4 : 1.8;
      m.add('armR', [c, c * 1.4, c], [st.x, st.top + 0.4, st.z], CRYSTAL, { glow: true, rot: [0, 0.785, 0] });
    }
  }
  if (level >= 9) {
    // rune che girano
    m.pivot('fx', [0, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      m.add('fx', [0.8, 1.1, 0.2], [Math.cos(a) * 8, f.legH + 2 + (i % 3) * 3, Math.sin(a) * 8], CRYSTAL, { glow: true, rot: [0, -a, 0] });
    }
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 10, 3, f.headTop + 4);
  return m.build();
}

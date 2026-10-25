import { hair, holdStick, humanFace, humanoid, type HumanoidFrame } from '../anatomy';
import { eyes, GOLD, ModelBuilder, pedestal, sparkles } from '../voxel';

const SKIN = '#f0b48c';
const SUIT = '#eef1f5';
const GRAY = '#c5cbd3';
const ORANGE = '#f08a24';
const CARDBOARD = '#c89a5b';

/** Casco aperto sul davanti (si vede la faccia), di cartone o da astronauta. */
function helmet(m: ModelBuilder, f: HumanoidFrame, color: string, rim?: string) {
  const t = 0.5;
  const S = f.headS + 1.2;
  const y0 = f.headY0 - 0.4;
  const top = y0 + S;
  const winBot = f.headY0 + f.headS * 0.1;
  const winTop = f.headY0 + f.headS * 0.84;
  const half = f.headS * 0.4;
  const z = S / 2 - t / 2;
  m.add('head', [S, S, t], [0, y0, -z], color);
  m.both('head', [t, S, S], [S / 2 - t / 2, y0, 0], color);
  m.add('head', [S, t, S], [0, top - t, 0], color);
  m.add('head', [S, top - winTop, t], [0, winTop, z], color);
  m.add('head', [S, winBot - y0, t], [0, y0, z], color);
  m.both('head', [S / 2 - half, winTop - winBot, t], [half + (S / 2 - half) / 2, winBot, z], color);
  if (rim) m.add('head', [S + 0.1, 0.6, S + 0.1], [0, y0, 0], rim);
  return { top, S };
}

/** Astronauta: dal casco di cartone al comandante con il jetpack. */
export function astronauta(level: number) {
  const flying = level >= 9;
  const m = new ModelBuilder(-0.45, flying ? 0.8 : 0.25);
  const kid = level <= 2;
  const f = humanoid(m, level, {
    skin: SKIN,
    torso: kid ? '#3fae5a' : SUIT,
    legs: kid ? '#3b5b8f' : SUIT,
    arms: kid ? SKIN : SUIT,
    hands: level >= 6 ? GRAY : SKIN,
    shoes: kid ? '#e8e8e8' : level >= 6 ? GRAY : '#9aa3ad',
  });
  if (kid) {
    // maniche corte della maglietta
    m.pair('armL', 'armR', [f.armW + 0.1, f.armLen * 0.4, f.armW + 0.1], [f.armX, f.shoulderY - f.armLen * 0.4, 0], '#3fae5a');
  }
  hair(m, f, '#a0522d');
  const face = humanFace(m, f);
  eyes(m, { cy: face.cy, front: f.front, gap: face.gap, w: face.w, h: face.h });

  if (kid) {
    // casco di cartone con le antenne fatte in casa
    const { top } = helmet(m, f, CARDBOARD);
    m.both('head', [0.3, 2.4, 0.3], [1.6, top, 0], '#9a9aa2', { rot: [0, 0, -0.2] });
    m.both('head', [0.9, 0.9, 0.9], [2.1, top + 2.2, 0], '#e23b3b');
  }
  if (level === 2) {
    // razzo giocattolo
    const x = f.armX;
    const y = f.handY0 - 0.6;
    m.add('armR', [1.4, 3.6, 1.4], [x, y, 1.4], '#ffffff');
    m.add('armR', [1, 1, 1], [x, y + 3.6, 1.4], '#e23b3b');
    m.add('armR', [2.4, 1, 0.3], [x, y, 1.4], '#e23b3b');
  }
  if (level === 3) {
    // cuffie con microfono da cadetto
    m.add('head', [f.headS + 0.5, 0.5, 1], [0, f.headTop - 0.1, 0], '#3a3f4a');
    m.both('head', [0.6, 2, 2], [f.headS / 2 + 0.3, f.headY0 + f.headS * 0.35, 0], '#3a3f4a');
    m.add('head', [0.3, 0.3, 3.2], [f.headS / 2 + 0.2, f.headY0 + f.headS * 0.25, f.front - 1.2], '#3a3f4a', { rot: [0, 0.5, 0] });
  }
  if (!kid) {
    // tuta: toppa arancione e cerniera
    m.add('body', [1.8, 1.8, 0.2], [f.torsoW * 0.22, f.legH + f.torsoH * 0.55, f.torsoD / 2 + 0.1], ORANGE);
    m.add('body', [0.4, f.torsoH * 0.8, 0.15], [-0.6, f.legH + 0.4, f.torsoD / 2 + 0.07], GRAY);
    m.add('body', [f.torsoW + 0.1, 0.8, f.torsoD + 0.1], [0, f.legH + 0.2, 0], GRAY);
  }
  if (level >= 4) {
    const { top, S } = helmet(m, f, '#ffffff', level === 10 ? GOLD : GRAY);
    // visiera dorata alzata
    m.add('head', [S - 1.2, 1.2, 1.6], [0, top - 0.4, S / 2 - 0.6], level === 10 ? GOLD : '#e8b84a');
    if (level >= 6) {
      m.add('head', [0.3, 2.6, 0.3], [S / 2 - 1, top, -1], '#9aa3ad');
      m.add('head', [0.7, 0.7, 0.7], [S / 2 - 1, top + 2.5, -1], '#ff4a4a', { glow: true });
    }
  }
  const backZ = -f.torsoD / 2;
  if (level >= 5 && level < 8) {
    // zaino di supporto vitale
    m.add('body', [f.torsoW - 0.6, f.torsoH * 0.85, 2.2], [0, f.legH + f.torsoH * 0.12, backZ - 1.1], SUIT);
    m.add('body', [f.torsoW - 1.6, 1, 0.3], [0, f.legH + f.torsoH * 0.6, backZ - 2.3], ORANGE);
    m.add('body', [1, 1, 0.3], [-1.4, f.legH + f.torsoH * 0.3, backZ - 2.3], '#3fae5a', { glow: true });
  }
  if (level === 7 || level === 8) {
    // bandiera di Techland
    const st = holdStick(m, f, { len: 16, w: 0.5, color: '#b8bec6', below: 0.25 });
    m.add('armR', [0.2, 3.4, 5.2], [st.x, st.top - 3.4, st.z - 2.6], '#3fae5a');
    m.add('armR', [0.25, 1.2, 1.2], [st.x, st.top - 2.3, st.z - 2.6], '#ffffff');
  }
  if (level >= 8) {
    // jetpack, con le fiamme quando vola
    for (const sx of [-1, 1]) {
      const x = sx * 1.4;
      const y = f.legH + f.torsoH * 0.1;
      m.add('body', [2.2, f.torsoH * 0.85, 2.2], [x, y, backZ - 1.3], '#b8bec6');
      m.add('body', [2.3, 0.9, 2.3], [x, y + f.torsoH * 0.85 - 0.9, backZ - 1.3], level === 10 ? GOLD : ORANGE);
      m.add('body', [1.4, 0.8, 1.4], [x, y - 0.8, backZ - 1.3], '#4a4f5a');
      if (flying) {
        const big = level === 10 ? 1.4 : 1;
        m.add('body', [1.3 * big, 2 * big, 1.3 * big], [x, y - 0.8 - 2 * big, backZ - 1.3], '#ff8a2a', { glow: true });
        m.add('body', [0.7 * big, 1.6 * big, 0.7 * big], [x, y - 0.8 - 3.4 * big, backZ - 1.3], '#ffd23a', { glow: true });
      }
    }
  }
  if (level === 10) {
    m.both('body', [2.2, 0.6, f.torsoD + 0.2], [f.torsoW / 2 - 0.6, f.shoulderY - 0.5, 0], GOLD);
    m.add('body', [1.8, 1.8, 0.25], [f.torsoW * 0.22, f.legH + f.torsoH * 0.55, f.torsoD / 2 + 0.15], GOLD);
  }
  if (flying) m.lift(3.5);

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 8, 4, f.headTop + 5);
  return m.build();
}

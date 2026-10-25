import { hair, humanFace, humanoid } from '../anatomy';
import { eyes, GOLD, ModelBuilder, pedestal, sparkles } from '../voxel';

const SKIN = '#8d5a3b';
const HAIR = '#1d1a1a';
const SWEATER = '#3fae5a';
const COAT = '#f4f5f7';
const CYAN = '#5ff2ff';

/** Nerd: dal piccolo curioso con gli occhialoni al genio con drone e ologramma. */
export function nerd(level: number) {
  const m = new ModelBuilder();
  const coat = level >= 6;
  const f = humanoid(m, level, {
    skin: SKIN,
    torso: SWEATER,
    legs: '#3b4a6b',
    arms: coat ? COAT : SWEATER,
    shoes: '#e8e8e8',
  });
  const s = f.headS;
  hair(m, f, HAIR, { fringe: 1.8, back: 0.55 });
  for (const [x, z] of [[-2.4, 0.5], [0.4, 1.4], [2.2, -0.6], [-0.8, -1.8]]) {
    m.add('head', [1.6, 1, 1.6], [x, f.headTop + 0.1, z], HAIR);
  }
  const face = humanFace(m, f);

  // occhialoni: montatura, lenti e occhi davanti alle lenti
  for (const sx of [-1, 1]) {
    const x = sx * face.gap / 2;
    m.add('head', [2.8, 2.8, 0.2], [x, face.cy - 1.95, f.front + 0.1], '#1d1d22');
    m.add('head', [2.1, 2.1, 0.15], [x, face.cy - 1.6, f.front + 0.22], '#d8f0ff');
    m.add('head', [0.2, 0.3, s * 0.6], [sx * (s / 2 + 0.1), face.cy - 0.6, f.front - s * 0.3], '#1d1d22');
  }
  m.add('head', [face.gap - 2.6, 0.35, 0.2], [0, face.cy - 0.5, f.front + 0.1], '#1d1d22');
  eyes(m, { cy: face.cy - 0.55, front: f.front + 0.2, gap: face.gap, w: face.w * 0.9, h: face.h * 0.8 });

  if (level >= 2 && level <= 4) {
    // berretto con l'elica (gira con gli effetti)
    const y = f.headTop - 0.6;
    for (const [sx, sz, c] of [[-1, 1, '#e23b3b'], [1, 1, '#ffd23a'], [-1, -1, '#3a7bd5'], [1, -1, '#3fae5a']] as const) {
      m.add('head', [s / 2 + 0.2, 1.8, s / 2 + 0.2], [sx * (s / 4 + 0.05), y, sz * (s / 4 + 0.05)], c);
    }
    m.add('head', [0.4, 1, 0.4], [0, y + 1.8, 0], '#8a8f99');
    m.pivot('fx', [0, 0, 0]);
    m.add('fx', [4.4, 0.25, 0.9], [0, y + 2.7, 0], '#e23b3b');
    m.add('fx', [0.9, 0.25, 4.4], [0, y + 2.7, 0], '#3a7bd5');
  }
  if (level >= 3) {
    // zaino rosso con gli spallacci
    m.add('body', [f.torsoW - 1, f.torsoH * 0.8, 2], [0, f.legH + f.torsoH * 0.1, -f.torsoD / 2 - 1], '#d64545');
    m.both('body', [1, f.torsoH * 0.6, 0.2], [f.torsoW / 2 - 1.4, f.torsoTop - f.torsoH * 0.6, f.torsoD / 2 + (coat ? 0.4 : 0.1)], '#a83232');
  }
  if (level >= 4) {
    // portatile sotto il braccio
    m.add('armL', [0.8, 4.2, 5.4], [-f.armX - 0.9, f.handY0 + 1, 0.4], '#8a8f99');
    m.add('armL', [0.1, 1, 1], [-f.armX - 1.35, f.handY0 + 2.6, 0.4], '#9dffb0', { glow: true });
  }
  if (level === 5 || level === 6) {
    // cuffie con microfono
    m.add('head', [s + 0.6, 0.6, 1.2], [0, f.headTop + 0.4, 0], '#2d3140');
    m.both('head', [0.8, 2.4, 2.4], [s / 2 + 0.4, f.headY0 + s * 0.35, 0], '#2d3140');
    m.add('head', [0.3, 0.3, 3.4], [s / 2 + 0.3, f.headY0 + s * 0.22, f.front - 1.3], '#2d3140', { rot: [0, 0.45, 0] });
    m.add('head', [0.3, 0.3, 0.3], [s / 2 + 0.6, f.headY0 + s * 0.4, 0.8], SWEATER, { glow: true });
  }
  if (coat) {
    // camice aperto sul maglione
    m.add('body', [f.torsoW + 0.3, f.torsoH, f.torsoD + 0.3], [0, f.legH, 0], COAT);
    m.add('body', [1.8, f.torsoH, 0.2], [0, f.legH, f.torsoD / 2 + 0.2], SWEATER);
    m.add('body', [f.torsoW + 0.4, f.legH * 0.5, f.torsoD + 0.4], [0, f.legH * 0.5, 0], COAT);
    m.add('body', [1.2, 1.4, 0.2], [-f.torsoW * 0.3, f.legH + f.torsoH * 0.6, f.torsoD / 2 + 0.2], '#3a7bd5');
    if (level === 10) m.add('body', [f.torsoW + 0.5, 0.4, f.torsoD + 0.5], [0, f.legH * 0.5, 0], GOLD);
  }
  if (level >= 7) {
    // visore VR sulla fronte
    m.add('head', [s + 0.3, 0.7, s + 0.3], [0, f.headTop - 1.6, 0], '#2d3140');
    m.add('head', [s * 0.8, 1.8, 1.4], [0, f.headTop - 2, f.front + 0.2], '#2d3140');
    m.add('head', [s * 0.6, 0.5, 0.2], [0, f.headTop - 1.4, f.front + 0.95], CYAN, { glow: true });
  }
  if (level >= 8) {
    // cintura degli attrezzi con la chiave inglese
    m.add('body', [f.torsoW + 0.6, 1, f.torsoD + 0.6], [0, f.legH + 0.3, 0], '#8b5a2b');
    m.add('body', [0.6, 2.6, 0.4], [f.torsoW * 0.3, f.legH - 1.4, f.torsoD / 2 + 0.4], '#9aa1ad');
    m.add('body', [1.4, 0.7, 0.4], [f.torsoW * 0.3, f.legH + 0.5, f.torsoD / 2 + 0.4], '#9aa1ad');
  }
  if (level >= 9) {
    // ologramma davanti a destra
    const x = f.armX + 2.6;
    const y = f.handY0 + 2;
    const z = f.torsoD / 2 + 2.4;
    m.add('body', [4.6, 3.4, 0.15], [x, y, z], '#9ff8ff', { glow: true, rot: [0, -0.3, 0] });
    for (let i = 0; i < 3; i++) m.add('body', [3.2 - i * 0.8, 0.3, 0.2], [x - 0.3, y + 0.7 + i * 0.9, z + 0.05], '#2fb9d6', { glow: true, rot: [0, -0.3, 0] });
  }
  if (level === 10) {
    // drone che gira attorno
    m.pivot('fx', [0, 0, 0]);
    const dy = f.headTop + 1.5;
    m.add('fx', [2.4, 0.9, 2.4], [8, dy, 0], '#6b7280');
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add('fx', [1.4, 0.2, 1.4], [8 + dx * 1.5, dy + 0.9, dz * 1.5], '#2d3140');
    m.add('fx', [0.6, 0.4, 0.6], [8, dy - 0.3, 1.2], '#9dffb0', { glow: true });
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 10, 3, f.headTop + 3);
  return m.build();
}

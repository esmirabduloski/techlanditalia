import { hair, humanFace, humanoid } from '../anatomy';
import { eyes, GOLD, lerp, ModelBuilder, pedestal, sparkles } from '../voxel';

const SKIN = '#c98d62';
const HAIR = '#3b2418';
const PAJAMA = '#9cc8f0';
const SUIT = '#2f6fe0';
const CAPE = '#e23b3b';
const YELLOW = '#f6c938';

/** Supereroe: dal piccolo in pigiama con l'asciugamano alla leggenda che vola. */
export function supereroe(level: number) {
  const flying = level >= 9;
  const m = new ModelBuilder(-0.45, flying ? 0.8 : 0.25);
  const suit = level >= 5;
  const f = humanoid(m, level, {
    skin: SKIN,
    torso: level <= 3 ? PAJAMA : SUIT,
    legs: level <= 3 ? PAJAMA : suit ? SUIT : '#3b5b8f',
    arms: level <= 3 ? PAJAMA : suit ? SUIT : SKIN,
    hands: level >= 6 ? CAPE : SKIN,
    shoes: level <= 3 ? '#f2f2f2' : level >= 5 ? (level === 10 ? GOLD : CAPE) : '#333a48',
  });
  const s = f.headS;
  hair(m, f, HAIR);
  const face = humanFace(m, f);

  if (level <= 3) {
    // pois del pigiama
    for (const [x, y] of [[-1.6, 0.3], [1.4, 0.65], [-0.2, 0.8], [0.8, 0.15]]) {
      m.add('body', [0.7, 0.7, 0.15], [x, f.legH + f.torsoH * y, f.torsoD / 2 + 0.05], '#ffffff');
    }
  }

  // maschera: occhi bianchi sulla benda scura
  const masked = level >= 2;
  if (masked) {
    m.add('head', [s + 0.12, 1.8, s + 0.12], [0, face.cy - 1.3, 0], level <= 3 ? '#1d1d22' : '#1d2a5a');
  }
  eyes(m, masked
    ? { cy: face.cy - 0.2, front: f.front + 0.06, gap: face.gap, w: 1.4, h: 0.9, color: '#ffffff', shine: false }
    : { cy: face.cy, front: f.front, gap: face.gap, w: face.w, h: face.h });

  // simbolo sul petto: stella di cartone, poi rombo con la stella, luminoso dall'8
  const chestY = f.legH + f.torsoH * 0.5;
  if (level === 3) m.add('body', [1.6, 1.6, 0.2], [0, chestY, f.torsoD / 2 + 0.1], YELLOW, { rot: [0, 0, 0.785] });
  if (level >= 4) {
    const k = level >= 7 ? 1.25 : 1;
    m.add('body', [2.8 * k, 2.8 * k, 0.2], [0, chestY - 0.6, f.torsoD / 2 + 0.1], level === 10 ? GOLD : YELLOW, { rot: [0, 0, 0.785], glow: level >= 8 });
    m.add('body', [1.2 * k, 1.2 * k, 0.2], [0, chestY + 0.2 * k, f.torsoD / 2 + 0.25], CAPE, { rot: [0, 0, 0.785] });
  }
  if (level >= 6) {
    m.add('body', [f.torsoW + 0.2, 0.9, f.torsoD + 0.2], [0, f.legH + 0.2, 0], level === 10 ? GOLD : '#ffcf3a');
    m.add('body', [1.6, 1.2, 0.3], [0, f.legH + 0.05, f.torsoD / 2 + 0.15], GOLD);
  }
  if (level >= 7) m.add('body', [f.torsoW + 0.1, Math.min(2.2, f.legH * 0.3), f.torsoD + 0.1], [0, f.legH - Math.min(2.2, f.legH * 0.3), 0], CAPE);

  // mantello: asciugamano a righe, poi rosso sempre più lungo; vola dietro quando vola
  const towel = level <= 3;
  const capeLen = towel ? f.torsoH + 1 : lerp(f.torsoH + 3, f.torsoH + f.legH - 0.5, (level - 4) / 6);
  const capeZ = -f.torsoD / 2 - 0.3;
  m.pivot('tail', [0, f.shoulderY, capeZ]);
  m.pose('tail', [flying ? 0.75 : 0.18, 0, 0]);
  m.add('tail', [f.torsoW + 0.8, capeLen, 0.4], [0, f.shoulderY - capeLen, capeZ], towel ? '#f2c94c' : CAPE);
  if (towel) {
    for (let i = 0; i < 3; i++) m.add('tail', [f.torsoW + 0.85, 0.6, 0.45], [0, f.shoulderY - capeLen + 1 + i * 1.6, capeZ], '#f07f5a');
  } else if (level === 10) {
    m.add('tail', [f.torsoW + 0.85, 0.5, 0.45], [0, f.shoulderY - capeLen, capeZ], GOLD);
  }
  m.both('body', [1.4, 0.8, f.torsoD + 0.6], [f.torsoW / 2 - 0.5, f.shoulderY - 0.3, -0.1], towel ? '#f2c94c' : CAPE);

  if (flying) {
    // un pugno al cielo
    m.pose('armR', [0, 0, Math.PI - 0.15]);
    m.lift(4);
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 9, 4, f.headTop + 6);
  return m.build();
}

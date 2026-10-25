import { growthOf, lerp, type ModelBuilder, type Part, type Vec3 } from './voxel';

/**
 * Scheletri condivisi: un bipede (persone, panda, gatto) e un quadrupede
 * (volpe, drago, unicorno). Crescono con il livello: da cucciolo con la testa
 * grande e le gambe corte (lv 1) a figura adulta (lv 10). Restituiscono i punti
 * d'aggancio per vestiti e accessori.
 */

export interface HumanoidColors {
  skin: string;
  torso: string;
  legs: string;
  shoes: string;
  arms?: string;
  hands?: string;
}

export interface HumanoidFrame {
  g: number;
  legH: number;
  torsoH: number;
  torsoW: number;
  torsoD: number;
  torsoTop: number;
  headS: number;
  headY0: number;
  headTop: number;
  /** z della faccia della testa. */
  front: number;
  shoulderY: number;
  armX: number;
  armW: number;
  armLen: number;
  /** y del fondo delle mani. */
  handY0: number;
}

export function humanoid(m: ModelBuilder, level: number, c: HumanoidColors, opts: { headScale?: number } = {}): HumanoidFrame {
  const g = growthOf(level);
  const headS = lerp(7, 8, g) * (opts.headScale ?? 1);
  const torsoH = lerp(4.5, 10, g);
  const torsoW = lerp(6, 8, g);
  const torsoD = lerp(3.6, 4.4, g);
  const legH = lerp(3, 10, g);
  const armW = lerp(2.2, 2.8, g);
  const armLen = lerp(4.2, 9.6, g);
  const torsoTop = legH + torsoH;
  const shoulderY = torsoTop;
  const armX = torsoW / 2 + armW / 2;
  const legW = torsoW / 2;

  for (const s of [-1, 1]) {
    m.add('body', [legW, legH, torsoD], [s * legW / 2, 0, 0], c.legs);
    m.add('body', [legW + 0.04, Math.min(1.2, legH * 0.35), torsoD + 0.6], [s * legW / 2, 0, 0.3], c.shoes);
  }
  m.add('body', [torsoW, torsoH, torsoD], [0, legH, 0], c.torso);

  const armD = Math.min(armW, torsoD);
  const handH = Math.min(1.6, armLen * 0.3);
  m.pair('armL', 'armR', [armW, armLen - handH, armD], [armX, shoulderY - armLen + handH, 0], c.arms ?? c.torso);
  m.pair('armL', 'armR', [armW, handH, armD], [armX, shoulderY - armLen, 0], c.hands ?? c.skin);
  m.pivot('armL', [-armX, shoulderY, 0]).pivot('armR', [armX, shoulderY, 0]);

  m.add('head', [headS, headS, headS], [0, torsoTop, 0], c.skin);
  m.pivot('head', [0, torsoTop, 0]);

  return {
    g, legH, torsoH, torsoW, torsoD, torsoTop, headS,
    headY0: torsoTop,
    headTop: torsoTop + headS,
    front: headS / 2,
    shoulderY, armX, armW, armLen,
    handY0: shoulderY - armLen,
  };
}

/** Oggetto lungo tenuto in mano (bastone, bacchetta, bandiera): attraversa il pugno. */
export function holdStick(
  m: ModelBuilder,
  f: HumanoidFrame,
  { len, w = 0.8, color, side = 'armR', below = 0.3, glow = false }:
    { len: number; w?: number; color: string; side?: Part; below?: number; glow?: boolean },
) {
  const x = side === 'armL' ? -f.armX : f.armX;
  const y0 = f.handY0 - len * below;
  m.add(side, [w, len, w], [x, y0, f.armW / 2 + w / 2 - 0.2], color, { glow });
  return { x, top: y0 + len, z: f.armW / 2 + w / 2 - 0.2 };
}

/** Capelli: calotta sopra la testa e pannello dietro. */
export function hair(m: ModelBuilder, f: HumanoidFrame, color: string, { fringe = 1.4, back = 0.6 } = {}) {
  const s = f.headS;
  m.add('head', [s + 0.4, fringe, s + 0.4], [0, f.headTop - fringe + 0.2, 0], color);
  m.add('head', [s + 0.4, s * back, 0.6], [0, f.headTop - s * back, -s / 2 - 0.1], color);
  m.both('head', [0.5, s * 0.45, s * 0.7], [s / 2 + 0.1, f.headTop - s * 0.45 - fringe + 0.4, -s * 0.12], color);
}

/** Viso umano semplice: occhi, bocca, guance rosa nei piccoli. */
export function humanFace(m: ModelBuilder, f: HumanoidFrame, { mouth = '#b5523b', blush = '#f2a0a0' } = {}) {
  const s = f.headS;
  const big = 1 - f.g;
  const cy = f.headY0 + s * lerp(0.44, 0.5, f.g);
  m.add('head', [s * 0.22, 0.5, 0.2], [0, f.headY0 + s * 0.2, f.front + 0.05], mouth);
  if (big > 0.4) m.both('head', [1.1, 0.6, 0.15], [s * 0.32, f.headY0 + s * 0.27, f.front + 0.05], blush);
  return { cy, gap: s * 0.42, w: lerp(1.3, 1.1, f.g), h: lerp(1.9, 1.5, f.g) };
}

export interface QuadColors {
  body: string;
  legs: string;
  hooves: string;
  head: string;
  snout: string;
  belly?: string;
}

export interface QuadFrame {
  g: number;
  legH: number;
  bodyH: number;
  bodyW: number;
  bodyLen: number;
  bodyTop: number;
  neckTop: number;
  headY0: number;
  headH: number;
  headW: number;
  headD: number;
  headZ: number;
  /** z della faccia della testa (sopra il muso). */
  front: number;
  snoutFront: number;
  snoutH: number;
  backZ: number;
  legW: number;
  /** Distanza delle zampe dal centro, in x e in z. */
  legX: number;
  legZ: number;
}

export function quadruped(
  m: ModelBuilder,
  level: number,
  c: QuadColors,
  { neck = 0, lenScale = 1, headScale = 1 }: { neck?: number; lenScale?: number; headScale?: number } = {},
): QuadFrame {
  const g = growthOf(level);
  const bodyLen = lerp(7, 14, g) * lenScale;
  const bodyH = lerp(4, 6.5, g);
  const bodyW = lerp(5, 7, g);
  const legH = lerp(2.5, 7.5, g);
  const legW = lerp(1.8, 2.4, g);
  const bodyTop = legH + bodyH;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (bodyW / 2 - legW / 2);
      const z = sz * (bodyLen / 2 - legW / 2 - 0.4);
      m.add('body', [legW, legH + 0.5, legW], [x, 0, z], c.legs);
      m.add('body', [legW + 0.06, Math.min(1, legH * 0.3), legW + 0.06], [x, 0, z], c.hooves);
    }
  }
  m.add('body', [bodyW, bodyH, bodyLen], [0, legH, 0], c.body);
  if (c.belly) m.add('body', [bodyW - 1.6, 0.3, bodyLen - 2], [0, legH - 0.15, 0], c.belly);

  const headW = lerp(5.5, 6, g) * headScale;
  const headH = lerp(5.5, 6, g) * headScale;
  const headD = lerp(5, 5.5, g) * headScale;
  const neckH = neck * lerp(0.4, 1, g);
  const neckD = Math.min(headD - 1, 3.4);
  const neckZ = bodyLen / 2 - neckD / 2 + 0.4;
  const neckTop = bodyTop - 1.5 + neckH;
  if (neckH > 0) m.add('body', [lerp(2.6, 3.4, g), neckH + 1.5, neckD], [0, bodyTop - 1.5, neckZ], c.body);

  const headY0 = neckTop - lerp(1.5, 2.5, g);
  const headZ = bodyLen / 2 + headD / 2 - 1.5 + (neckH > 0 ? 0.8 : 0);
  m.add('head', [headW, headH, headD], [0, headY0, headZ], c.head);
  const snoutH = headH * 0.4;
  const snoutD = lerp(1.6, 2.4, g);
  const front = headZ + headD / 2;
  m.add('head', [headW * 0.6, snoutH, snoutD], [0, headY0, front + snoutD / 2], c.snout);
  m.pivot('head', [0, headY0 + headH * 0.3, headZ - headD / 2]);

  return {
    g, legH, bodyH, bodyW, bodyLen, bodyTop, neckTop,
    headY0, headH, headW, headD, headZ, front,
    snoutFront: front + snoutD,
    snoutH,
    backZ: -bodyLen / 2,
    legW,
    legX: bodyW / 2 - legW / 2,
    legZ: bodyLen / 2 - legW / 2 - 0.4,
  };
}

export interface ChainSegment {
  len: number;
  w: number;
  h?: number;
  color: string;
  glow?: boolean;
  /** Inclinazione verso l'alto di questo pezzo; di default quella della catena. */
  pitch?: number;
}

/**
 * Catena di box che parte da `origin` all'indietro (-z), inclinata verso l'alto
 * di `pitch` e aperta di lato di `spread`: code, criniere, mantelli.
 * Restituisce il punto finale.
 */
export function chain(
  m: ModelBuilder,
  part: Part,
  origin: Vec3,
  { pitch, spread = 0 }: { pitch: number; spread?: number },
  segments: ChainSegment[],
): Vec3 {
  let p: Vec3 = [...origin];
  for (const seg of segments) {
    const a = seg.pitch ?? pitch;
    const d: Vec3 = [-Math.sin(spread), Math.cos(spread) * Math.sin(a), -Math.cos(spread) * Math.cos(a)];
    const center: Vec3 = [p[0] + d[0] * seg.len / 2, p[1] + d[1] * seg.len / 2, p[2] + d[2] * seg.len / 2];
    m.put(part, [seg.w, seg.h ?? seg.w, seg.len], center, seg.color, { rot: [a, Math.PI + spread, 0], glow: seg.glow });
    p = [p[0] + d[0] * seg.len * 0.85, p[1] + d[1] * seg.len * 0.85, p[2] + d[2] * seg.len * 0.85];
  }
  return p;
}

import { chain, quadruped } from '../anatomy';
import { eyes, GOLD, lerp, ModelBuilder, pedestal, sparkles, type Part } from '../voxel';

const G = '#3fae5a';
const GD = '#2b8443';
const BELLY = '#f0d27a';
const MEMBRANE = '#7fd18a';
const HORN = '#f4ecd8';
const FIRE = ['#ff6a1f', '#ff9a2a', '#ffd23a'];
// apertura delle ali per livello (0 = niente ali)
const WINGS = [0, 0, 0, 1.4, 4, 4.8, 6, 9, 9.5, 10, 11.5];

/** Uovo con gli occhi che spuntano dalla crepa, sopra un nido. */
function egg(m: ModelBuilder) {
  const shell = '#e9f3dc';
  const spot = '#7cc68a';
  for (const [w, h, y0] of [[5, 1, 0.6], [6.6, 5, 1.6], [5.6, 1.6, 6.6], [3.8, 1, 8.2]]) {
    m.add('head', [w, h, w], [0, y0, 0], shell);
  }
  for (const [x, y, z, s] of [[-1.8, 2.6, 1, 1.6], [2, 5.2, 0.6, 1.2], [3.3, 3, -1, 1.4], [-3.3, 5.5, -0.8, 1.1], [0.5, 7.2, 2.8, 1]]) {
    const onSide = Math.abs(x) > 3;
    m.add('head', onSide ? [0.2, s, s] : [s, s, 0.2], [x, y, onSide ? z : 3.3], spot);
  }
  // crepa con il buio dentro e gli occhi
  m.add('head', [4.4, 2, 0.1], [0, 4.1, 3.32], '#2a2a2a');
  for (let i = 0; i < 6; i++) {
    m.add('head', [0.9, 0.4, 0.15], [-2.6 + i * 1.05, i % 2 ? 6.2 : 5.9, 3.34], '#3d3d3d');
    m.add('head', [0.9, 0.4, 0.15], [-2.6 + i * 1.05, i % 2 ? 3.9 : 4.2, 3.34], '#3d3d3d');
  }
  eyes(m, { cy: 5.3, front: 3.35, gap: 2.4, w: 1, h: 1.3, color: '#ffd23a', shine: false });
  m.add('eyes', [0.4, 0.9, 0.1], [-1.2, 4.6, 3.55], '#1d1d22');
  m.add('eyes', [0.4, 0.9, 0.1], [1.2, 4.6, 3.55], '#1d1d22');
  m.pivot('head', [0, 0, 0]);
  // nido di rametti
  for (const [w, d, x, z, r] of [[8, 1, 0, 3.2, 0.1], [8, 1, 0, -3.2, -0.1], [1, 8, 3.2, 0, 0.1], [1, 8, -3.2, 0, -0.1]]) {
    m.add('body', [w, 1, d], [x, 0, z], '#a0703c', { rot: [0, r, 0] });
  }
}

/** Ala a vela dritta sopra la schiena (piano y-z), incernierata lungo la spina. */
function wing(m: ModelBuilder, part: Part, sx: number, x: number, y: number, z: number, span: number, gold: boolean) {
  const bone = gold ? GOLD : GD;
  m.pivot(part, [sx * x, y, z]);
  m.pose(part, [0, 0, -sx * 0.45]);
  m.add(part, [0.8, span, 0.8], [sx * x, y, z], bone);
  m.add(part, [0.8, 0.8, span * 0.85], [sx * x, y + span - 0.8, z - span * 0.85 / 2 + 0.4], bone);
  // membrana a gradini sotto l'osso
  const steps = Math.max(1, Math.round(span / 2.2));
  const segD = (span * 0.85) / steps;
  for (let i = 0; i < steps; i++) {
    const h = (span - 0.8) * (1 - i / (steps + 0.6));
    m.add(part, [0.35, h, segD], [sx * x, y + span - 0.8 - h, z - 0.4 - segD / 2 - i * segD], MEMBRANE);
  }
}

/** Drago: dall'uovo misterioso al drago leggendario che sputa fuoco. */
export function drago(level: number) {
  const m = new ModelBuilder(-0.85);
  if (level === 1) {
    egg(m);
    pedestal(m, level, 14, 18);
    return m.build();
  }

  const f = quadruped(m, level, { body: G, legs: G, hooves: level === 10 ? GOLD : HORN, head: G, snout: '#56c06f', belly: BELLY }, { neck: 2.2 });
  const { g } = f;

  // pancia, narici, occhi
  m.add('body', [f.bodyW + 0.04, f.bodyH * 0.45, f.bodyLen * 0.75], [0, f.legH - 0.02, 0.4], BELLY);
  m.both('head', [0.5, 0.5, 0.2], [0.9, f.headY0 + f.snoutH - 0.7, f.snoutFront], GD);
  eyes(m, { cy: f.headY0 + f.headH * 0.68, front: f.front, gap: f.headW * 0.5, w: lerp(1.3, 1.1, g), h: lerp(1.8, 1.5, g) });

  if (level === 2) {
    // guscio rotto in testa
    const y = f.headY0 + f.headH - 0.5;
    m.add('head', [f.headW + 0.6, 1.4, f.headD + 0.6], [0, y, f.headZ], '#e9f3dc');
    for (let i = 0; i < 4; i++) m.add('head', [1, 1.2, 1], [-2 + i * 1.35, y + 1.4, f.headZ + (i % 2 ? 1 : -1)], '#e9f3dc');
  }

  // coda: più lunga a ogni livello, con la punta a picca dal livello 8
  const tailLen = lerp(3, 10, g);
  m.pivot('tail', [0, f.legH + f.bodyH * 0.6, f.backZ]);
  const tip = chain(m, 'tail', [0, f.legH + f.bodyH * 0.6, f.backZ + 0.5], { pitch: -0.15 }, [
    { len: tailLen * 0.45, w: lerp(2.6, 3.2, g), color: G },
    { len: tailLen * 0.35, w: lerp(1.9, 2.4, g), color: G, pitch: 0.15 },
    { len: tailLen * 0.3, w: lerp(1.3, 1.6, g), color: G, pitch: 0.5 },
  ]);
  if (level >= 8) m.put('tail', [2.6, 0.6, 2.6], [tip[0], tip[1] + 0.2, tip[2] - 0.6], level === 10 ? GOLD : GD, { rot: [0.5, 0.78, 0] });

  const span = WINGS[level];
  if (span > 0) {
    for (const [part, sx] of [['wingL', -1], ['wingR', 1]] as const) {
      wing(m, part, sx, f.bodyW / 2 - 1, f.bodyTop - 0.4, f.bodyLen * 0.2, span, level === 10);
    }
  }
  if (level >= 5) {
    // cresta di spine lungo la schiena
    const n = Math.round(f.bodyLen / 2);
    for (let i = 0; i < n; i++) {
      const h = 1 + ((i + 1) % 2) * 0.6;
      m.add('body', [0.7, h, 1], [0, f.bodyTop, f.bodyLen / 2 - 1.5 - i * 2], level === 10 ? GOLD : GD);
    }
  }
  if (level >= 6) {
    const h = level >= 7 ? 3 : 1.6;
    const color = level === 10 ? GOLD : HORN;
    for (const sx of [-1, 1]) {
      m.add('head', [1, h, 1], [sx * (f.headW / 2 - 1.1), f.headY0 + f.headH - 0.3, f.headZ - f.headD / 2 + 0.8], color, { rot: [-0.55, 0, sx * 0.15] });
    }
  }
  if (level === 8) {
    // sbuffi di fumo
    for (const [dx, dy, dz, s] of [[0.9, 0.6, 0.5, 0.9], [1.3, 1.6, 0.9, 1.2], [0.6, 2.8, 1.5, 1]]) {
      m.add('head', [s, s, s], [dx, f.headY0 + f.snoutH + dy, f.snoutFront + dz], '#c9ccd2');
    }
  }
  if (level >= 9) {
    // fuoco: più lungo al livello 10
    const flames = level === 10 ? [1.2, 1.9, 2.6] : [0.9, 1.5, 2];
    let z = f.snoutFront + 0.4;
    flames.forEach((s, i) => {
      m.put('head', [s, s, s], [0, f.headY0 + f.snoutH * 0.6, z + s / 2], FIRE[Math.min(2, i)], { glow: true, rot: [0.3 * i, 0.4 * i, 0] });
      if (i > 0) m.put('head', [s * 0.5, s * 0.5, s * 0.5], [0, f.headY0 + f.snoutH * 0.6, z + s / 2 + 0.2], '#fff3b0', { glow: true });
      z += s * 0.85;
    });
  }

  pedestal(m, level, 14, 18);
  if (level === 10) sparkles(m, 8, 3, f.neckTop + 5);
  return m.build();
}

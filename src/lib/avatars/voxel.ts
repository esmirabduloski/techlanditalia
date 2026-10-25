/**
 * Mattoncini per gli avatar 3D a blocchi (stile della mascotte Techland).
 *
 * Un avatar è una lista di box colorati raggruppati per parte del corpo: la
 * scena three.js (scene.ts) unisce i box di ogni parte in una sola geometria e
 * anima le parti attorno al loro perno. Qui niente three.js: i modelli sono
 * dati puri, così si testano con vitest e lo stesso modello produce sia la
 * figura live sia le immagini pre-renderizzate (scripts/render-avatars.mjs).
 *
 * Unità: 1 = un "pixel" della mascotte. y verso l'alto, il personaggio guarda
 * verso +z, i piedi poggiano su y = 0 (sotto c'è il basamento).
 */

export type Vec3 = [number, number, number];

export type Part =
  | 'base'
  | 'body'
  | 'head'
  | 'eyes'
  | 'armL'
  | 'armR'
  | 'tail'
  | 'wingL'
  | 'wingR'
  | 'fx';

export const PARTS: Part[] = ['base', 'body', 'head', 'eyes', 'armL', 'armR', 'tail', 'wingL', 'wingR', 'fx'];

/** Gli occhi seguono la testa; tutte le altre parti stanno sul corpo. */
export const PARENT: Partial<Record<Part, Part>> = { eyes: 'head' };

export interface Box {
  size: Vec3;
  /** Centro del box. */
  pos: Vec3;
  color: string;
  part: Part;
  /** Rotazione (radianti, ordine XYZ) attorno al centro del box. */
  rot?: Vec3;
  /** Non illuminato: fuoco, cristalli, scintille. */
  glow?: boolean;
}

export interface AvatarModel {
  boxes: Box[];
  /** Perno di ogni parte animata, in coordinate del modello. */
  pivots: Partial<Record<Part, Vec3>>;
  /** Rotazione di riposo di una parte attorno al suo perno (es. braccio alzato). */
  poses: Partial<Record<Part, Vec3>>;
  /** Rotazione della figura nella vista di 3/4. */
  yaw: number;
  /** Ampiezza del respiro; più alta per chi vola. */
  bob: number;
}

type BoxOpts = { rot?: Vec3; glow?: boolean };

export class ModelBuilder {
  boxes: Box[] = [];
  pivots: Partial<Record<Part, Vec3>> = {};
  poses: Partial<Record<Part, Vec3>> = {};

  constructor(
    public yaw = -0.45,
    public bob = 0.25,
  ) {}

  /** Box con la base a y0: comodo per impilare. x e z sono il centro. */
  add(part: Part, size: Vec3, [x, y0, z]: Vec3, color: string, opts: BoxOpts = {}) {
    this.boxes.push({ size, pos: [x, y0 + size[1] / 2, z], color, part, ...opts });
    return this;
  }

  /** Box dato il centro (per pezzi ruotati, come le code). */
  put(part: Part, size: Vec3, center: Vec3, color: string, opts: BoxOpts = {}) {
    this.boxes.push({ size, pos: center, color, part, ...opts });
    return this;
  }

  /** Solleva tutto tranne il basamento: per chi vola. */
  lift(dy: number) {
    for (const b of this.boxes) if (b.part !== 'base') b.pos = [b.pos[0], b.pos[1] + dy, b.pos[2]];
    for (const p of Object.keys(this.pivots) as Part[]) {
      const v = this.pivots[p]!;
      this.pivots[p] = [v[0], v[1] + dy, v[2]];
    }
    return this;
  }

  /** Coppia speculare rispetto a x = 0: `left` va a -x, `right` a +x. */
  pair(left: Part, right: Part, size: Vec3, [x, y0, z]: Vec3, color: string, opts: BoxOpts = {}) {
    const rot = opts.rot;
    this.add(left, size, [-x, y0, z], color, { ...opts, rot: rot && [rot[0], -rot[1], -rot[2]] });
    this.add(right, size, [x, y0, z], color, opts);
    return this;
  }

  /** Come pair ma sulla stessa parte (orecchie, occhi, piedi). */
  both(part: Part, size: Vec3, pos: Vec3, color: string, opts: BoxOpts = {}) {
    return this.pair(part, part, size, pos, color, opts);
  }

  pivot(part: Part, p: Vec3) {
    this.pivots[part] = p;
    return this;
  }

  pose(part: Part, r: Vec3) {
    this.poses[part] = r;
    return this;
  }

  build(): AvatarModel {
    return { boxes: this.boxes, pivots: this.pivots, poses: this.poses, yaw: this.yaw, bob: this.bob };
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 al livello 1, 1 al livello 10. */
export function growthOf(level: number) {
  return (Math.min(10, Math.max(1, Math.round(level))) - 1) / 9;
}

export type Tier = 'grass' | 'stone' | 'amethyst' | 'gold';

/** Stesse fasce dei bordi di AvatarDisplay: 1–3, 4–6, 7–9, 10. */
export function tierOf(level: number): Tier {
  if (level >= 10) return 'gold';
  if (level >= 7) return 'amethyst';
  if (level >= 4) return 'stone';
  return 'grass';
}

export const GOLD = '#f2c230';
export const GOLD_LIGHT = '#ffe27a';

/** Basamento a blocco sotto i piedi, uguale per tutti i livelli di un personaggio. */
export function pedestal(m: ModelBuilder, level: number, w: number, d: number) {
  const h = 3;
  const tier = tierOf(level);
  if (tier === 'grass') {
    m.add('base', [w, h - 1, d], [0, -h, 0], '#8b5a2b');
    m.add('base', [w + 0.02, 1, d + 0.02], [0, -1, 0], '#5fb43c');
    // frange d'erba sui lati e qualche ciuffo
    m.add('base', [w + 0.04, 0.6, d + 0.04], [0, -1.6, 0], '#4f9a31');
    m.add('base', [1, 1, 1], [-w / 2 + 1.5, 0, d / 2 - 2], '#6cc447');
    m.add('base', [1, 0.8, 1], [w / 2 - 2, 0, -d / 2 + 1.5], '#6cc447');
    m.add('base', [0.8, 0.8, 0.8], [w / 2 - 1.2, 0, d / 2 - 1.2], '#f4d03f');
  } else if (tier === 'stone') {
    m.add('base', [w, h, d], [0, -h, 0], '#8c8f96');
    m.add('base', [w + 0.02, 0.4, d + 0.02], [0, -0.4, 0], '#a3a6ad');
    for (const [x, y, z] of [[-0.3, -2.2, 0.5], [0.25, -1.4, 0.5], [0.5, -2.6, -0.5], [-0.5, -1.2, -0.5]] as Vec3[]) {
      m.add('base', [1.4, 0.8, 0.2], [x * w, y, z * d + (z > 0 ? 0.05 : -0.05)], '#6f727a');
    }
    m.add('base', [0.2, 0.8, 1.4], [w / 2 + 0.05, -2, d * 0.2], '#6f727a');
  } else if (tier === 'amethyst') {
    m.add('base', [w, h, d], [0, -h, 0], '#5b3a99');
    m.add('base', [w + 0.02, 0.4, d + 0.02], [0, -0.4, 0], '#7b56c4');
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx * (w / 2 - 1.2);
      const z = sz * (d / 2 - 1.2);
      m.add('base', [1.2, 2.6, 1.2], [x, 0, z], '#c9a6ff', { glow: true, rot: [0.15 * sz, 0, -0.15 * sx] });
      m.add('base', [0.8, 1.4, 0.8], [x - sx * 1.1, 0, z], '#a77bf0', { rot: [0, 0, -0.35 * sx] });
    }
  } else {
    m.add('base', [w, h, d], [0, -h, 0], GOLD);
    m.add('base', [w + 0.02, 0.4, d + 0.02], [0, -0.4, 0], GOLD_LIGHT);
    m.add('base', [w + 0.04, 0.5, d + 0.04], [0, -h, 0], '#c99a1c');
    for (const [x, y] of [[-0.3, -2], [0.2, -1.4], [0.35, -2.3]]) {
      m.add('base', [0.6, 0.6, 0.2], [x * w, y, d / 2 + 0.05], '#fff6c9', { glow: true });
    }
  }
}

/** Scintille dorate che girano attorno alla figura al livello 10. */
export function sparkles(m: ModelBuilder, radius: number, yMin: number, yMax: number, count = 9) {
  m.pivot('fx', [0, 0, 0]);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const y = yMin + ((i * 7) % count) / count * (yMax - yMin);
    const s = i % 3 === 0 ? 1 : 0.65;
    m.add('fx', [s, s, s], [Math.cos(a) * radius, y, Math.sin(a) * radius], i % 2 ? GOLD_LIGHT : '#fff3b0', {
      glow: true,
      rot: [0.6, a, 0.6],
    });
  }
}

/**
 * Occhi su una faccia rivolta verso +z: nero con il punto di luce, più grandi
 * nei cuccioli. cy è il centro degli occhi, front la z della faccia.
 */
export function eyes(
  m: ModelBuilder,
  { cx = 0, cy, front, gap, w = 1.2, h = 1.6, color = '#1d1d22', shine = true }:
    { cx?: number; cy: number; front: number; gap: number; w?: number; h?: number; color?: string; shine?: boolean },
) {
  m.pivot('eyes', [cx, cy, front]);
  for (const s of [-1, 1]) {
    const x = cx + s * gap / 2;
    m.add('eyes', [w, h, 0.3], [x, cy - h / 2, front + 0.1], color);
    if (shine) m.add('eyes', [w * 0.45, w * 0.45, 0.1], [x + w * 0.2, cy + h / 2 - w * 0.55, front + 0.3], '#ffffff');
  }
}

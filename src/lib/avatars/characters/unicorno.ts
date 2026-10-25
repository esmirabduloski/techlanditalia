import { chain, quadruped } from '../anatomy';
import { eyes, GOLD, GOLD_LIGHT, lerp, ModelBuilder, pedestal, sparkles, type Part } from '../voxel';

const W = '#f7f4fb';
const HOOF = '#cdbfe6';
const PINK = ['#f39ac7', '#e979b6'];
const RAINBOW = ['#ff5a5a', '#ff9f43', '#ffd93d', '#5cd67a', '#4fa8ff', '#9b6cff'];
const FEATHER = ['#ffffff', '#efe9fb', '#e2d9f7'];

/** Ala di piume bianche sopra la schiena, a gradini come quelle del drago. */
function wing(m: ModelBuilder, part: Part, sx: number, x: number, y: number, z: number, span: number, gold: boolean) {
  m.pivot(part, [sx * x, y, z]);
  m.pose(part, [0, 0, -sx * 0.5]);
  const rows = Math.max(2, Math.round(span / 2));
  for (let i = 0; i < rows; i++) {
    const h = span * (1 - i / rows) + 0.6;
    m.add(part, [0.6, h, 1.6], [sx * x, y, z - i * 1.4], FEATHER[i % 3]);
  }
  m.add(part, [0.7, 0.8, rows * 1.4], [sx * x, y + span - 0.2, z - rows * 0.7 + 0.7], gold ? GOLD : '#ffffff');
}

/** Unicorno: dal puledro senza corno all'alicorno con le ali. */
export function unicorno(level: number) {
  const m = new ModelBuilder(-0.85);
  const gold = level === 10;
  const f = quadruped(m, level, { body: W, legs: W, hooves: gold ? GOLD : HOOF, head: W, snout: '#f1e8f7' }, { neck: 3.2, lenScale: 1.05 });
  const { g } = f;

  m.both('head', [0.45, 0.45, 0.2], [0.8, f.headY0 + f.snoutH - 0.8, f.snoutFront], '#c9a9c9');
  m.both('head', [0.9, 1.6, 0.6], [f.headW / 2 - 0.9, f.headY0 + f.headH, f.headZ - 1.2], W);
  m.both('head', [0.5, 1, 0.2], [f.headW / 2 - 0.9, f.headY0 + f.headH + 0.2, f.headZ - 0.85], '#f6c6dd');
  eyes(m, { cy: f.headY0 + f.headH * 0.64, front: f.front, gap: f.headW * 0.52, w: lerp(1.3, 1.1, g), h: lerp(1.9, 1.6, g) });
  if (f.g < 0.5) m.both('head', [1, 0.6, 0.15], [f.headW * 0.36, f.headY0 + f.headH * 0.3, f.front + 0.05], '#f8bcd8');

  // criniera lungo il collo e ciuffo sulla fronte: rosa, poi arcobaleno dal livello 7
  const mane = (i: number) => (level >= 7 ? RAINBOW[i % RAINBOW.length] : PINK[i % 2]);
  const maneLen = Math.round(lerp(2, 6, g));
  for (let i = 0; i < maneLen; i++) {
    m.add('head', [1.5, 1.8, 1.5], [0, f.headY0 + f.headH - 0.6 - i * 1.5, f.headZ - f.headD / 2 - 0.5 - i * 0.25], mane(i));
  }
  m.add('head', [1.8, 1.2, 1.4], [0, f.headY0 + f.headH - 0.2, f.headZ + 0.6], mane(1));

  // coda
  m.pivot('tail', [0, f.bodyTop - 1, f.backZ]);
  const tailColors = level >= 8 ? RAINBOW : level >= 2 ? [PINK[0], PINK[1], PINK[0]] : [PINK[0]];
  chain(m, 'tail', [0, f.bodyTop - 1, f.backZ + 0.3], { pitch: -0.6 }, tailColors.slice(0, level >= 8 ? 5 : 3).map((color, i) => ({
    len: lerp(1.8, 2.4, g), w: lerp(1.6, 2.2, g), color, pitch: -0.4 - i * 0.25,
  })));

  // corno: un bozzetto al 3, spuntato al 4, a spirale dal 5, luminoso dall'8
  const hornX = 0;
  const hornY = f.headY0 + f.headH - 0.1;
  const hornZ = f.headZ + 1.2;
  if (level === 3) m.add('head', [0.9, 0.8, 0.9], [hornX, hornY, hornZ], '#ffe9a8');
  if (level === 4) m.add('head', [0.9, 2.6, 0.9], [hornX, hornY, hornZ], '#ffe9a8', { rot: [0.35, 0, 0] });
  if (level >= 5) {
    const n = level >= 8 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const s = 1.1 - i * 0.15;
      const c = gold ? (i % 2 ? GOLD : GOLD_LIGHT) : i % 2 ? '#f0b84a' : '#ffe9a8';
      m.add('head', [s, 1, s], [hornX, hornY + i * 0.9, hornZ + i * 0.35], c, { rot: [0.35, i * 0.4, 0], glow: level >= 8 && i === n - 1 });
    }
  }
  if (level >= 6) {
    // ghirlanda di fiori
    const flowers = ['#ff7eb6', '#ffd93d', '#7ec8ff', '#ff9f43', '#c59bff'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 2.2;
      m.add('head', [1, 1, 1], [Math.sin(a) * (f.headW / 2 + 0.2), f.headY0 + f.headH - 1, f.headZ + Math.cos(a) * (f.headD / 2) - 0.2], flowers[i]);
    }
  }
  const span = level === 9 ? 5 : level === 10 ? 9 : 0;
  if (span > 0) {
    for (const [part, sx] of [['wingL', -1], ['wingR', 1]] as const) {
      wing(m, part, sx, f.bodyW / 2 - 0.8, f.bodyTop - 0.4, f.bodyLen * 0.25, span, gold);
    }
  }

  pedestal(m, level, 13, 19);
  if (gold) sparkles(m, 8, 3, f.neckTop + 5);
  return m.build();
}

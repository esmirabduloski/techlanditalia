import { chain, holdStick, humanoid } from '../anatomy';
import { eyes, GOLD, lerp, ModelBuilder, pedestal, sparkles, type Vec3 } from '../voxel';

const FUR = '#a7b0c2';
const STRIPE = '#7a8396';
const LIGHT = '#eef0f5';
const SUIT = '#24283b';
const RED = '#d6453a';

/** Katana nel fodero, di traverso sulla schiena: il manico spunta sopra la spalla. */
function katana(m: ModelBuilder, cy: number, z: number, tilt: number, gold: boolean) {
  const at = (d: number): Vec3 => [-Math.sin(tilt) * d, cy + Math.cos(tilt) * d, z];
  m.put('body', [0.9, 12, 0.9], at(0), '#3a2a2a', { rot: [0, 0, tilt] });
  m.put('body', [2.2, 0.5, 1.4], at(6.2), gold ? GOLD : '#8a8f99', { rot: [0, 0, tilt] });
  m.put('body', [0.8, 3.2, 0.8], at(8), gold ? GOLD : '#c9b28a', { rot: [0, 0, tilt] });
}

/** Shuriken: due box incrociati. */
function shuriken(m: ModelBuilder, [x, y, z]: Vec3) {
  m.add('body', [1.6, 0.5, 0.2], [x, y, z], '#9aa1ad', { rot: [0, 0, 0.785] });
  m.add('body', [1.6, 0.5, 0.2], [x, y, z], '#9aa1ad', { rot: [0, 0, -0.785] });
}

/** Gatto Ninja: da gattino al gran maestro con due katane. */
export function gatto(level: number) {
  const m = new ModelBuilder();
  const suit = level >= 7;
  const f = humanoid(m, level, {
    skin: FUR,
    torso: level >= 6 ? SUIT : FUR,
    legs: suit ? SUIT : FUR,
    arms: suit ? SUIT : FUR,
    shoes: suit ? '#151826' : LIGHT,
    hands: LIGHT,
  });
  const s = f.headS;

  // orecchie, strisce, muso, naso, baffi
  for (const sx of [-1, 1]) {
    const x = sx * (s / 2 - 1.1);
    m.add('head', [2.2, 1.8, 1.2], [x, f.headTop, -0.4], FUR);
    m.add('head', [1.2, 1.2, 0.8], [x, f.headTop + 1.6, -0.4], FUR);
    m.add('head', [1.1, 1.3, 0.2], [x, f.headTop + 0.1, 0.25], '#f4b6c8');
  }
  for (const x of [-1.4, 0, 1.4]) m.add('head', [0.6, 1.6, 0.2], [x, f.headTop - 1.6, f.front + 0.02], STRIPE);
  if (level < 6) {
    m.add('head', [s * 0.44, s * 0.28, 0.5], [0, f.headY0 + s * 0.08, f.front], LIGHT);
    m.add('head', [1, 0.7, 0.2], [0, f.headY0 + s * 0.3, f.front + 0.25], '#f29ab5');
    m.both('head', [2.2, 0.2, 0.1], [s * 0.38, f.headY0 + s * 0.24, f.front + 0.1], '#5d6474');
  } else {
    // maschera da ninja sul muso
    m.add('head', [s + 0.12, s * 0.4, s + 0.12], [0, f.headY0 - 0.02, 0], SUIT);
  }
  eyes(m, {
    cy: f.headY0 + s * 0.6, front: f.front, gap: s * 0.42,
    w: lerp(1.4, 1.2, f.g), h: lerp(1.9, 1.5, f.g),
    color: level >= 9 ? '#ffd23a' : '#2f5b3a', shine: level < 9,
  });
  if (level >= 9) m.add('eyes', [0.35, 1.2, 0.1], [-s * 0.21, f.headY0 + s * 0.6 - 1.3, f.front + 0.45], '#1d1d22').add('eyes', [0.35, 1.2, 0.1], [s * 0.21, f.headY0 + s * 0.6 - 1.3, f.front + 0.45], '#1d1d22');

  // coda arricciata
  m.pivot('tail', [0, f.legH + 0.8, -f.torsoD / 2]);
  chain(m, 'tail', [0, f.legH + 0.8, -f.torsoD / 2 + 0.3], { pitch: 0.2 }, [
    { len: lerp(2.4, 4, f.g), w: 1.4, color: FUR },
    { len: lerp(2, 3.4, f.g), w: 1.4, color: STRIPE, pitch: 0.9 },
    { len: lerp(1.6, 2.6, f.g), w: 1.4, color: FUR, pitch: 1.4 },
    { len: 1.4, w: 1.5, color: level >= 7 ? SUIT : STRIPE, pitch: 1.9 },
  ]);

  if (level >= 2 && level < 6) {
    // collare con il campanello
    m.add('body', [f.torsoW * 0.8, 0.8, f.torsoD + 0.3], [0, f.torsoTop - 0.8, 0], RED);
    m.add('body', [1, 1, 1], [0, f.torsoTop - 1.6, f.torsoD / 2 + 0.3], GOLD);
  }
  const bandY = f.headY0 + s * 0.74;
  if (level === 3) m.add('head', [s + 0.14, 0.9, s + 0.14], [0, bandY, 0], '#ffffff');
  if (level >= 4) {
    // fascia da ninja con il nodo e le code
    const band = level === 10 ? GOLD : RED;
    m.add('head', [s + 0.14, 0.9, s + 0.14], [0, bandY, 0], band);
    m.add('head', [0.9, 2.6, 0.3], [0.5, bandY - 2.2, -s / 2 - 0.3], band, { rot: [0.35, 0, 0.3] });
    m.add('head', [0.9, 2.2, 0.3], [-0.5, bandY - 1.9, -s / 2 - 0.3], band, { rot: [0.35, 0, -0.25] });
  }
  if (level >= 5) {
    // fusciacca in vita
    m.add('body', [f.torsoW + 0.2, 1.1, f.torsoD + 0.2], [0, f.legH + 0.3, 0], RED);
    m.add('body', [1.2, 1.8, 0.3], [f.torsoW * 0.3, f.legH - 1, f.torsoD / 2 + 0.1], RED, { rot: [0, 0, -0.2] });
  }
  if (level === 5 || level === 6) holdStick(m, f, { len: 9, w: 0.8, color: '#b58a5a', below: 0.25 });
  const katanaY = f.torsoTop - f.torsoH * 0.45;
  if (level >= 7) katana(m, katanaY, -f.torsoD / 2 - 0.6, 0.7, level === 10);
  if (level === 10) katana(m, katanaY, -f.torsoD / 2 - 1.6, -0.7, true);
  if (level >= 8) {
    shuriken(m, [-f.torsoW * 0.3, f.legH + 0.85, f.torsoD / 2 + 0.25]);
    m.pair('armL', 'armR', [f.armW + 0.2, 0.5, f.armW + 0.2], [f.armX, f.handY0 + 1.8, 0], '#e8e4da');
    m.pair('armL', 'armR', [f.armW + 0.2, 0.5, f.armW + 0.2], [f.armX, f.handY0 + 2.8, 0], '#e8e4da');
  }
  if (level >= 9) {
    // cappuccio con le orecchie fuori
    m.add('head', [s + 0.3, 1.6, s + 0.3], [0, f.headTop - 1.4, 0], SUIT);
    m.add('head', [s + 0.3, s * 0.7, 0.6], [0, f.headTop - s * 0.7, -s / 2 - 0.2], SUIT);
  }

  pedestal(m, level, 14, 14);
  if (level === 10) sparkles(m, 9, 3, f.headTop + 3);
  return m.build();
}

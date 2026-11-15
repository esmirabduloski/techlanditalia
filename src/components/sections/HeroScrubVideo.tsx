import { useEffect, useRef, useState } from "react";
// Clip "sinistra-destra" (1280x720, 24 fps, 37 fotogrammi): i bambini girano la
// testa da sinistra a destra. Vive nel repo (src/assets ->
// /assets/sinistra-destra-<hash>.mp4, cache immutable), rimuxata in fast-start.
import sinistraDestraVideo from "@/assets/sinistra-destra.mp4";

const VIDEO_SRC = sinistraDestraVideo;
const ARIA_LABEL = "Bambini che imparano programmazione con TECHLAND";

const FPS = 24;
const SRC_W = 1280;
const SRC_H = 720;
// Il riquadro è quadrato: del video si vede solo la fascia centrale 720x720.
const VIEW = 720;
const CROP_X = (SRC_W - VIEW) / 2;

// Della clip usiamo solo il tratto "frontale -> profilo destro": nel tratto
// verso sinistra i bambini sbattono le palpebre e resterebbero a occhi chiusi.
// Lo sguardo a sinistra si ottiene specchiando ogni bambino sul proprio asse.
// [fotogramma, angolo dello sguardo in gradi]
const POSES: ReadonlyArray<readonly [number, number]> = [
  [11, 0],
  [12, 12],
  [13, 20],
  [14, 28],
  [15, 36],
  [16, 44],
  [17, 53],
  [18, 61],
  [19, 68],
  [20, 75],
  [21, 80],
  [22, 85],
];

// Asse di simmetria (x nel video) di ciascun bambino.
const KIDS = [{ axis: 484 }, { axis: 789 }] as const;
// Ritaglio attorno a testa e spalle, in pixel del video. Parte sotto le
// scritte, che restano sempre quelle del fotogramma di base (mai specchiate).
const HALF_W = 140;
const TOP = 340;
const SOLID_BOTTOM = 546; // fin qui il ritaglio è pieno...
const BOTTOM = 572; // ...poi sfuma sulla maglietta, che non si muove
const PATCH_W = HALF_W * 2;
const PATCH_H = BOTTOM - TOP;
// Punto della testa da cui parte il riconoscimento della sagoma.
const SEED_Y = 430 - TOP;

// Distanza virtuale del cursore "davanti" ai bambini, in frazione del lato del
// riquadro: più è piccola, più la testa gira per lo stesso spostamento.
const DEPTH = 0.3;
const SMOOTHING_MS = 110;
// Altezza degli occhi (y nel video): da lì si misura quanto il cursore è sopra o sotto.
const EYES_Y = 430;
// Zona del volto e perno del collo, in pixel del ritaglio.
const FACE_CENTER: readonly [number, number] = [HALF_W, EYES_Y - TOP + 5];
const FACE_RADII: readonly [number, number] = [112, 108];
const NECK_PIVOT: readonly [number, number] = [HALF_W, 505 - TOP];
// Su/giù: la clip contiene solo la rotazione orizzontale, quindi la testa
// intera si alza/abbassa e si inclina sul collo (di profilo), mentre di
// fronte il volto scende o sale leggermente dentro la sagoma.
const PITCH_GAIN = 1.6; // quanto in fretta si arriva all'inclinazione massima
const TILT_RAD = 0.24; // inclinazione massima della testa (di profilo)
const LIFT_PX = 9; // quanto la testa si alza/abbassa (di fronte)
const NOD_PX = 12; // quanto il volto sale/scende nella sagoma (di fronte)
// Passaggio destra <-> sinistra sopra la testa: breve giro animato, con un po'
// di isteresi per non rimbalzare quando il cursore resta sul confine.
const SWING_MS = 220;
const SWING_HYSTERESIS = 2.5;

type Patch = HTMLCanvasElement;
type Sprites = {
  base: HTMLCanvasElement;
  patches: Patch[][];
  /** Per bambino: di quanti pixel si spostano i lineamenti da una posa alla successiva. */
  shifts: number[][];
  /** Per bambino: quanto la testa (sagoma) è spostata rispetto all'asse del busto nella posa frontale. */
  headOffset: number[];
  /** Per bambino: la posa usata come "frontale", cioè quella con la testa più dritta. */
  front: number[];
  /** Per bambino: quanto i lineamenti sono fuori centro rispetto alla sagoma in quella posa. */
  faceLag: number[];
};

// Fascia del volto (occhi, naso, bocca) usata per allineare due pose vicine.
const FACE_X0 = HALF_W - 62;
const FACE_X1 = HALF_W + 62;
const FACE_Y0 = 395 - TOP;
const FACE_Y1 = 492 - TOP;
const MAX_SHIFT = 32;
// Oltre questo scarto (in pixel) tra volto e sagoma si cerca una posa più dritta.
const MAX_FACE_LAG = 7;
const MAX_FRONT_POSE = 2;
const FACE_BAND: readonly [number, number] = [FACE_Y0, FACE_Y1];
const EYE_BAND: readonly [number, number] = [EYES_Y - TOP - 18, EYES_Y - TOP + 18];

function luminance(px: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(PATCH_W * PATCH_H);
  for (let i = 0; i < out.length; i++) {
    out[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
  }
  return out;
}

/** Distanza (in pixel) tra il centro della testa, all'altezza degli occhi, e l'asse del ritaglio. */
function headOffCenter(mask: Uint8Array): number {
  let sum = 0;
  let rows = 0;
  for (let y = FACE_Y0; y < FACE_Y0 + 50; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < PATCH_W; x++) {
      if (!mask[y * PATCH_W + x]) continue;
      if (min < 0) min = x;
      max = x;
    }
    if (min < 0) continue;
    sum += (min + max) / 2 - (PATCH_W - 1) / 2;
    rows++;
  }
  return rows ? sum / rows : 0;
}

function mirrored(gray: Uint8Array): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < PATCH_H; y++) {
    const row = y * PATCH_W;
    for (let x = 0; x < PATCH_W; x++) out[row + x] = gray[row + PATCH_W - 1 - x];
  }
  return out;
}

/** Spostamento orizzontale che sovrappone al meglio il volto di `from` a quello di `to`. */
function faceShift(from: Uint8Array, to: Uint8Array, band = FACE_BAND): number {
  let best = 0;
  let bestScore = Infinity;
  for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift++) {
    let score = 0;
    for (let y = band[0]; y < band[1]; y += 2) {
      const row = y * PATCH_W;
      for (let x = FACE_X0; x < FACE_X1; x += 2) {
        score += Math.abs(to[row + x + shift] - from[row + x]);
      }
    }
    if (score < bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  return best;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timer = setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("seek timeout"));
    }, 4000);
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** Sagoma del bambino nel ritaglio: tutto ciò che non è cielo e sta attaccato alla testa. */
function kidMask(px: Uint8ClampedArray): Uint8Array {
  const w = PATCH_W;
  const h = PATCH_H;
  const n = w * h;
  // Il cielo è chiaro e poco saturo; pelle, capelli e maglietta no.
  const sky = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    sky[i] = px[o] > 232 && px[o + 1] > 190 && px[o + 2] > 135 ? 1 : 0;
  }
  // Cielo raggiungibile dai bordi (così il bianco degli occhi non conta come cielo).
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const pushSky = (i: number) => {
    if (sky[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    pushSky(x);
    pushSky((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushSky(y * w);
    pushSky(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) pushSky(i - 1);
    if (x < w - 1) pushSky(i + 1);
    if (i >= w) pushSky(i - w);
    if (i < n - w) pushSky(i + w);
  }
  // Solo la parte collegata alla testa: esclude i pallini decorativi vicini.
  const kid = new Uint8Array(n);
  const pushKid = (i: number) => {
    if (!outside[i] && !kid[i]) {
      kid[i] = 1;
      stack.push(i);
    }
  };
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) pushKid((SEED_Y + dy) * w + HALF_W + dx);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w) pushKid(yy * w + xx);
      }
    }
  }
  return kid;
}

/** Ritaglio del bambino con trasparenza: bordo morbido e sfumatura in basso. */
function buildPatch(image: ImageData, mask: Uint8Array): Patch {
  const w = PATCH_W;
  const h = PATCH_H;
  const px = image.data;
  for (let y = 0; y < h; y++) {
    const fade =
      y + TOP <= SOLID_BOTTOM ? 1 : (BOTTOM - (y + TOP)) / (BOTTOM - SOLID_BOTTOM);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += mask[yy * w + xx];
          count++;
        }
      }
      px[(y * w + x) * 4 + 3] = Math.round((sum / count) * 255 * fade);
    }
  }
  const canvas = makeCanvas(w, h);
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  return canvas;
}

/** Cancella il bambino dal fotogramma di base ricostruendo il cielo dietro. */
function eraseKid(image: ImageData, mask: Uint8Array) {
  const w = PATCH_W;
  const px = image.data;
  const rows = SOLID_BOTTOM - TOP;
  const GROW = 4;
  for (let y = 0; y < rows; y++) {
    // Sagoma allargata di qualche pixel, per non lasciare aloni sul bordo.
    const covered = new Uint8Array(w);
    for (let yy = Math.max(0, y - GROW); yy <= Math.min(PATCH_H - 1, y + GROW); yy++) {
      for (let x = 0; x < w; x++) {
        if (!mask[yy * w + x]) continue;
        const from = Math.max(0, x - GROW);
        const to = Math.min(w - 1, x + GROW);
        for (let k = from; k <= to; k++) covered[k] = 1;
      }
    }
    let x = 0;
    while (x < w) {
      if (!covered[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && covered[x]) x++;
      const end = x - 1;
      const left = start > 0 ? (y * w + start - 1) * 4 : -1;
      const right = end < w - 1 ? (y * w + end + 1) * 4 : -1;
      if (left < 0 && right < 0) continue;
      const a = left >= 0 ? left : right;
      const b = right >= 0 ? right : left;
      const span = end - start + 2;
      for (let k = start; k <= end; k++) {
        const t = (k - start + 1) / span;
        const o = (y * w + k) * 4;
        px[o] = px[a] + (px[b] - px[a]) * t;
        px[o + 1] = px[a + 1] + (px[b + 1] - px[a + 1]) * t;
        px[o + 2] = px[a + 2] + (px[b + 2] - px[a + 2]) * t;
      }
    }
  }
}

async function extractSprites(video: HTMLVideoElement): Promise<Sprites> {
  const work = makeCanvas(SRC_W, SRC_H);
  const wctx = work.getContext("2d", { willReadFrequently: true })!;
  const base = makeCanvas(VIEW, VIEW);
  const patches: Patch[][] = KIDS.map(() => []);
  const shifts: number[][] = KIDS.map(() => []);
  const headOffset: number[] = [];
  const faceLag: number[] = [];
  const front: number[] = KIDS.map(() => 0);
  const faceCenter: number[] = [];
  const previous: Uint8Array[] = [];

  for (let p = 0; p < POSES.length; p++) {
    await seekTo(video, (POSES[p][0] + 0.5) / FPS);
    wctx.drawImage(video, 0, 0, SRC_W, SRC_H);
    if (p === 0) base.getContext("2d")!.drawImage(work, -CROP_X, 0);
    KIDS.forEach((kid, k) => {
      const x0 = kid.axis - HALF_W;
      const image = wctx.getImageData(x0, TOP, PATCH_W, PATCH_H);
      const mask = kidMask(image.data);
      const gray = luminance(image.data);
      if (p > 0) shifts[k].push(faceShift(previous[k], gray));
      // Nella clip gli occhi anticipano la testa: nel primo fotogramma lo
      // sguardo è al centro ma la testa è ancora girata, e specchiandola
      // salterebbe dall'altra parte. Tra le prime pose scegliamo come
      // "frontale" quella in cui il volto è meglio centrato nella sagoma:
      // così tra guardare a destra e a sinistra la testa cambia il meno possibile.
      if (p === 0) {
        headOffset[k] = headOffCenter(mask);
        faceCenter[k] = -faceShift(gray, mirrored(gray), EYE_BAND) / 2;
        faceLag[k] = headOffset[k] - faceCenter[k];
      } else if (p <= MAX_FRONT_POSE) {
        faceCenter[k] += shifts[k][p - 1];
        const lag = headOffCenter(mask) - faceCenter[k];
        if (Math.abs(faceLag[k]) > MAX_FACE_LAG && Math.abs(lag) < Math.abs(faceLag[k])) {
          front[k] = p;
          faceLag[k] = lag;
          headOffset[k] = headOffCenter(mask);
        }
      }
      previous[k] = gray;
      if (p === 0) {
        const clean = wctx.getImageData(x0, TOP, PATCH_W, PATCH_H);
        eraseKid(clean, mask);
        base
          .getContext("2d")!
          .putImageData(clean, x0 - CROP_X, TOP, 0, 0, PATCH_W, SOLID_BOTTOM - TOP);
      }
      patches[k].push(buildPatch(image, mask));
    });
  }
  return { base, patches, shifts, headOffset, faceLag, front };
}

type Look = {
  yaw: number;
  pitch: number;
  /** Da che lato sta guardando: 1 destra (pose originali), -1 sinistra (pose specchiate). */
  side: 1 | -1;
  /** Avanzamento del giro tra i due lati: 0 destra, 1 sinistra. */
  swing: number;
};
type Renderer = (looks: Look[]) => void;

const VERTEX_SHADER = `
attribute vec2 a_pos;
uniform vec4 u_rect;
varying vec2 v_p;
void main() {
  v_p = a_pos * u_rect.zw;
  vec2 p = (u_rect.xy + v_p) / ${VIEW}.0;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;

// Ogni bambino è la miscela di due pose vicine, fatte scivolare di pochi pixel
// l'una verso l'altra così il passaggio è continuo. La testa si muove rigida.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_p;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform vec2 u_size;
uniform vec2 u_center;
uniform vec2 u_radii;
uniform vec2 u_pivot;
uniform vec2 u_shiftA;
uniform vec2 u_shiftB;
uniform float u_flipA;
uniform float u_flipB;
uniform float u_headA;
uniform float u_headB;
uniform float u_mix;
uniform float u_lift;
uniform float u_rot;
vec4 pose(sampler2D tex, vec2 shift, float flip, float head) {
  float r = min(1.0, length((v_p - u_center) / u_radii));
  float w = cos(1.5707963 * r);
  vec2 q = v_p - shift * w * w;
  // 1 sulla testa, 0 dalle spalle in giù: il collo fa da raccordo.
  float m = 1.0 - smoothstep(u_pivot.y - 8.0, u_pivot.y + 22.0, v_p.y);
  q.x -= head * m;
  q.y -= u_lift * m;
  float a = u_rot * m;
  vec2 d = q - u_pivot;
  q = u_pivot + vec2(cos(a) * d.x + sin(a) * d.y, cos(a) * d.y - sin(a) * d.x);
  vec2 uv = q / u_size;
  if (flip > 0.5) uv.x = 1.0 - uv.x;
  return texture2D(tex, uv);
}
void main() {
  gl_FragColor = mix(
    pose(u_a, u_shiftA, u_flipA, u_headA),
    pose(u_b, u_shiftB, u_flipB, u_headB),
    u_mix
  );
}`;

const RAD = Math.PI / 180;

type Blend = {
  a: number;
  b: number;
  flipA: boolean;
  flipB: boolean;
  /** Peso della posa b, da 0 a 1. */
  mix: number;
  /** Spostamento dei lineamenti da a verso b, in pixel sullo schermo. */
  slide: number;
};

/** Le due pose da mostrare per lo sguardo richiesto, per un dato bambino. */
function blendFor(look: Look, sprites: Sprites, kid: number): Blend {
  // Giro in corso: la posa frontale si trasforma nel proprio riflesso.
  if (look.swing > 0 && look.swing < 1) {
    const t = look.swing;
    return {
      a: sprites.front[kid],
      b: sprites.front[kid],
      flipA: false,
      flipB: true,
      mix: t * t * (3 - 2 * t),
      slide: 2 * sprites.faceLag[kid],
    };
  }
  const left = look.side < 0;
  const angle = Math.min(Math.max(left ? -look.yaw : look.yaw, 0), POSES[POSES.length - 1][1]);
  const front = sprites.front[kid];
  let lower = front;
  while (lower < POSES.length - 2 && POSES[lower + 1][1] <= angle) lower++;
  const from = lower === front ? 0 : POSES[lower][1];
  const to = POSES[lower + 1][1];
  return {
    a: lower,
    b: lower + 1,
    flipA: left,
    flipB: left,
    mix: (angle - from) / (to - from),
    slide: (left ? -1 : 1) * sprites.shifts[kid][lower],
  };
}

function createWebglRenderer(canvas: HTMLCanvasElement, sprites: Sprites): Renderer | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
  const texture = (source: HTMLCanvasElement) => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const base = texture(sprites.base);
  const patches = sprites.patches.map((list) => list.map(texture));

  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    rect: u("u_rect"),
    size: u("u_size"),
    shiftA: u("u_shiftA"),
    shiftB: u("u_shiftB"),
    flipA: u("u_flipA"),
    flipB: u("u_flipB"),
    headA: u("u_headA"),
    headB: u("u_headB"),
    mix: u("u_mix"),
    rot: u("u_rot"),
    lift: u("u_lift"),
  };
  gl.uniform1i(u("u_a"), 0);
  gl.uniform1i(u("u_b"), 1);
  gl.uniform2f(u("u_center"), FACE_CENTER[0], FACE_CENTER[1]);
  gl.uniform2f(u("u_radii"), FACE_RADII[0], FACE_RADII[1]);
  gl.uniform2f(u("u_pivot"), NECK_PIVOT[0], NECK_PIVOT[1]);
  gl.viewport(0, 0, VIEW, VIEW);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const bind = (a: WebGLTexture, b: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b);
  };

  return (looks) => {
    // Sfondo, scritte e magliette: sempre il fotogramma di base, mai deformato.
    gl.disable(gl.BLEND);
    bind(base, base);
    gl.uniform4f(loc.rect, 0, 0, VIEW, VIEW);
    gl.uniform2f(loc.size, VIEW, VIEW);
    gl.uniform2f(loc.shiftA, 0, 0);
    gl.uniform2f(loc.shiftB, 0, 0);
    gl.uniform1f(loc.flipA, 0);
    gl.uniform1f(loc.flipB, 0);
    gl.uniform1f(loc.headA, 0);
    gl.uniform1f(loc.headB, 0);
    gl.uniform1f(loc.mix, 0);
    gl.uniform1f(loc.rot, 0);
    gl.uniform1f(loc.lift, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    gl.uniform2f(loc.size, PATCH_W, PATCH_H);
    KIDS.forEach((kid, k) => {
      const { yaw } = looks[k];
      const { a, b, flipA, flipB, mix, slide } = blendFor(looks[k], sprites, k);
      const pitch = Math.max(-1, Math.min(1, looks[k].pitch * PITCH_GAIN));
      const frontal = Math.cos(yaw * RAD);
      const nod = NOD_PX * pitch * frontal;
      bind(patches[k][a], patches[k][b]);
      gl.uniform4f(loc.rect, kid.axis - CROP_X - HALF_W, TOP, PATCH_W, PATCH_H);
      // Ogni posa scivola verso l'altra: a metà strada i lineamenti coincidono.
      const head = (flip: boolean) => (flip ? -1 : 1) * sprites.headOffset[k];
      gl.uniform2f(loc.shiftA, slide * mix, nod);
      gl.uniform2f(loc.shiftB, -slide * (1 - mix), nod);
      gl.uniform1f(loc.flipA, flipA ? 1 : 0);
      gl.uniform1f(loc.flipB, flipB ? 1 : 0);
      gl.uniform1f(loc.headA, head(flipA));
      gl.uniform1f(loc.headB, head(flipB));
      gl.uniform1f(loc.mix, mix);
      gl.uniform1f(loc.rot, TILT_RAD * Math.sin(yaw * RAD) * pitch);
      gl.uniform1f(loc.lift, LIFT_PX * pitch * frontal);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  };
}

/** Ripiego senza WebGL: posa più vicina, senza deformazioni. */
function createCanvasRenderer(canvas: HTMLCanvasElement, sprites: Sprites): Renderer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return (looks) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sprites.base, 0, 0);
    KIDS.forEach((kid, k) => {
      const blend = blendFor(looks[k], sprites, k);
      const second = blend.mix > 0.5;
      const pose = second ? blend.b : blend.a;
      const axis = kid.axis - CROP_X;
      if (second ? blend.flipB : blend.flipA) ctx.setTransform(-1, 0, 0, 1, 2 * axis, 0);
      else ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sprites.patches[k][pose], axis - HALF_W, TOP);
    });
  };
}

/**
 * I due bambini dell'hero seguono il cursore: ognuno gira testa e occhi verso
 * il punto esatto in cui si trova il mouse (destra, sinistra, su e giù), in modo
 * indipendente dall'altro e senza scatti tra una posa e l'altra.
 * Riempie il contenitore in cui viene montato; solo desktop (serve il cursore).
 */
export function HeroScrubVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sprites, setSprites] = useState<Sprites | null>(null);
  const [failed, setFailed] = useState(false);
  // Il blocco hero è visibile solo da lg in su: non scarichiamo il video su mobile/tablet
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Prepara i fotogrammi una volta sola, appena il video è decodificabile.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDesktop) return;
    let cancelled = false;

    const start = () => {
      extractSprites(video)
        .then((result) => {
          if (!cancelled) setSprites(result);
        })
        .catch(() => {
          // Se il browser non permette l'estrazione resta il video fermo sul frontale.
          if (cancelled) return;
          setFailed(true);
          video.currentTime = (POSES[0][0] + 0.5) / FPS;
        });
    };

    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });
    const onError = () => setFailed(true);
    video.addEventListener("error", onError);
    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", start);
      video.removeEventListener("error", onError);
    };
  }, [isDesktop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprites) return;
    const render =
      createWebglRenderer(canvas, sprites) ?? createCanvasRenderer(canvas, sprites);
    if (!render) {
      setFailed(true);
      return;
    }
    const looks: Look[] = KIDS.map(() => ({ yaw: 0, pitch: 0, side: 1, swing: 0 }));
    const targets = KIDS.map(() => ({ yaw: 0, pitch: 0 }));
    let mouse: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(now - last, 100) : 16;
      last = now;
      const blend = 1 - Math.exp(-dt / SMOOTHING_MS);
      let moving = false;
      looks.forEach((look, k) => {
        const dYaw = targets[k].yaw - look.yaw;
        const dPitch = targets[k].pitch - look.pitch;
        if (Math.abs(dYaw) > 0.05 || Math.abs(dPitch) > 0.002) {
          look.yaw += dYaw * blend;
          look.pitch += dPitch * blend;
          moving = true;
        } else {
          look.yaw = targets[k].yaw;
          look.pitch = targets[k].pitch;
        }
        // Cambio di lato: parte il giro, e finché non è finito lo sguardo
        // resta vicino al centro (così non si salta a metà movimento).
        if (look.side > 0 && look.yaw < -SWING_HYSTERESIS) look.side = -1;
        else if (look.side < 0 && look.yaw > SWING_HYSTERESIS) look.side = 1;
        const goal = look.side < 0 ? 1 : 0;
        if (look.swing !== goal) {
          const step = dt / SWING_MS;
          look.swing =
            goal > look.swing ? Math.min(1, look.swing + step) : Math.max(0, look.swing - step);
          look.yaw = Math.max(-SWING_HYSTERESIS, Math.min(SWING_HYSTERESIS, look.yaw));
          moving = true;
        }
      });
      render(looks);
      if (moving) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const aim = () => {
      if (!mouse) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const scale = rect.width / VIEW;
      const depth = rect.width * DEPTH;
      const dy = mouse.y - (rect.top + EYES_Y * scale);
      KIDS.forEach((kid, k) => {
        const dx = mouse!.x - (rect.left + (kid.axis - CROP_X) * scale);
        targets[k].yaw = Math.atan2(dx, depth) / RAD;
        // Seno dell'elevazione: -1 dritto in alto, +1 dritto in basso.
        targets[k].pitch = dy / Math.hypot(dx, dy, depth);
      });
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
      aim();
    };
    const onContextLost = () => setFailed(true);

    render(looks);
    canvas.addEventListener("webglcontextlost", onContextLost);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => canvas.removeEventListener("webglcontextlost", onContextLost);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", aim, { passive: true });
    window.addEventListener("resize", aim);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", aim);
      window.removeEventListener("resize", aim);
    };
  }, [sprites]);

  if (!isDesktop) return null;

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        aria-label={ARIA_LABEL}
        aria-hidden={!failed}
        className={`w-full h-full object-cover ${failed ? "" : "invisible"}`}
        style={{ objectPosition: "center center" }}
      />
      {!failed && (
        <canvas
          ref={canvasRef}
          width={VIEW}
          height={VIEW}
          role="img"
          aria-label={ARIA_LABEL}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            sprites ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

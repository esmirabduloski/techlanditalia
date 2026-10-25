import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Framing } from './catalog';
import { buildAvatar } from './characters';
import { PARENT, PARTS, type AvatarModel, type Box, type Part, type Vec3 } from './voxel';

/**
 * Unico file che importa three.js: si carica con import() dinamico solo nelle
 * pagine con la figura live (Profilo, Dashboard, festa di livello) e nello
 * script che pre-renderizza le immagini.
 *
 * Camera ortografica leggermente dall'alto. Nella vista "full" l'inquadratura
 * è la stessa per tutti i livelli di un personaggio, così il cucciolo appare
 * davvero più piccolo dell'adulto, e copre tutta la rotazione permessa col
 * trascinamento (±YAW_RANGE): la figura non esce mai dal riquadro e l'immagine
 * statica coincide con il primo frame live. La vista "face" (solo immagini)
 * stringe sulla testa per gli avatar piccoli.
 */

export type { Framing };

const ELEVATION = 0.32;
/** Quanto si può girare la figura trascinandola, attorno alla vista di 3/4. */
const YAW_RANGE = 0.7;
const COS_E = Math.cos(ELEVATION);
const SIN_E = Math.sin(ELEVATION);

interface Frame {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** Matrice di una parte nel modello: perno + posa, compresa quella del genitore. */
function partMatrix(model: AvatarModel, part: Part): THREE.Matrix4 {
  const parent = PARENT[part];
  const base = parent ? partMatrix(model, parent) : new THREE.Matrix4();
  const pivot = model.pivots[part] ?? [0, 0, 0];
  const parentPivot = parent ? (model.pivots[parent] ?? [0, 0, 0]) : [0, 0, 0];
  const pose = model.poses[part] ?? [0, 0, 0];
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose)),
    new THREE.Vector3(1, 1, 1),
  );
  return base.multiply(local);
}

/** Gli 8 spigoli di un box in coordinate del modello, con la posa della sua parte. */
function boxCorners(model: AvatarModel, box: Box): THREE.Vector3[] {
  const pivot = model.pivots[box.part] ?? [0, 0, 0];
  const m = partMatrix(model, box.part).multiply(
    new THREE.Matrix4().compose(
      new THREE.Vector3(box.pos[0] - pivot[0], box.pos[1] - pivot[1], box.pos[2] - pivot[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(box.rot ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  const [w, h, d] = box.size.map((v) => v / 2);
  const out: THREE.Vector3[] = [];
  for (const x of [-w, w]) for (const y of [-h, h]) for (const z of [-d, d]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
}

class Bounds {
  left = Infinity;
  right = -Infinity;
  bottom = Infinity;
  top = -Infinity;

  /** Spigolo del modello visto con la figura ruotata di `yaw`. */
  add(c: THREE.Vector3, yaw: number, lift = 0) {
    const x = c.x * Math.cos(yaw) + c.z * Math.sin(yaw);
    const z = -c.x * Math.sin(yaw) + c.z * Math.cos(yaw);
    const sy = c.y * COS_E - z * SIN_E;
    this.left = Math.min(this.left, x);
    this.right = Math.max(this.right, x);
    this.bottom = Math.min(this.bottom, sy);
    this.top = Math.max(this.top, sy + lift * COS_E);
  }

  /** Spigolo che gira attorno all'asse verticale (effetti): tutto il cerchio. */
  addOrbit(c: THREE.Vector3) {
    const rho = Math.hypot(c.x, c.z);
    this.left = Math.min(this.left, -rho);
    this.right = Math.max(this.right, rho);
    this.bottom = Math.min(this.bottom, c.y * COS_E - rho * SIN_E);
    this.top = Math.max(this.top, c.y * COS_E + rho * SIN_E);
  }

  square(margin: number): Frame {
    const size = Math.max(this.right - this.left, this.top - this.bottom) * margin;
    const cx = (this.left + this.right) / 2;
    const cy = (this.top + this.bottom) / 2;
    return { left: cx - size / 2, right: cx + size / 2, bottom: cy - size / 2, top: cy + size / 2 };
  }
}

const fullFrames = new Map<number, Frame>();

function fullFrame(avatarId: number): Frame {
  const cached = fullFrames.get(avatarId);
  if (cached) return cached;
  const b = new Bounds();
  for (let level = 1; level <= 10; level++) {
    const model = buildAvatar(avatarId, level);
    for (const box of model.boxes) {
      for (const c of boxCorners(model, box)) {
        if (box.part === 'fx') {
          b.addOrbit(c);
          continue;
        }
        for (let i = -2; i <= 2; i++) b.add(c, model.yaw + (i / 2) * YAW_RANGE, box.part === 'base' ? 0 : model.bob);
      }
    }
  }
  const frame = b.square(1.04);
  fullFrames.set(avatarId, frame);
  return frame;
}

function faceFrame(model: AvatarModel): Frame {
  const b = new Bounds();
  for (const box of model.boxes) {
    if (box.part !== 'head' && box.part !== 'eyes') continue;
    for (const c of boxCorners(model, box)) b.add(c, model.yaw);
  }
  // un po' di spalle sotto la testa
  b.bottom -= (b.top - b.bottom) * 0.22;
  return b.square(1.1);
}

function applyFrame(camera: THREE.OrthographicCamera, f: Frame, aspect = 1) {
  const w = f.right - f.left;
  const h = f.top - f.bottom;
  const extraW = aspect > 1 ? (h * aspect - w) / 2 : 0;
  const extraH = aspect < 1 ? (w / aspect - h) / 2 : 0;
  camera.left = f.left - extraW;
  camera.right = f.right + extraW;
  camera.bottom = f.bottom - extraH;
  camera.top = f.top + extraH;
  camera.updateProjectionMatrix();
}

function makeCamera() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  camera.position.set(0, SIN_E * 150, COS_E * 150);
  camera.lookAt(0, 0, 0);
  return camera;
}

function makeScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#9c97b0', 2.1));
  const sun = new THREE.DirectionalLight('#fff8ec', 2.4);
  sun.position.set(6, 10, 8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5);
  fill.position.set(-8, 3, 5);
  scene.add(fill);
  return scene;
}

const tmpColor = new THREE.Color();

function geometryFor(boxes: Box[], pivot: Vec3): THREE.BufferGeometry | null {
  if (boxes.length === 0) return null;
  const parts = boxes.map((b) => {
    const g = new THREE.BoxGeometry(...b.size);
    g.deleteAttribute('uv');
    if (b.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...b.rot)));
    g.translate(b.pos[0] - pivot[0], b.pos[1] - pivot[1], b.pos[2] - pivot[2]);
    tmpColor.set(b.color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

interface BuiltAvatar {
  root: THREE.Group;
  figure: THREE.Group;
  groups: Map<Part, THREE.Group>;
  model: AvatarModel;
  dispose(): void;
}

const litMaterial = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMaterial = () => new THREE.MeshBasicMaterial({ vertexColors: true });

function buildObject(model: AvatarModel): BuiltAvatar {
  const root = new THREE.Group();
  const figure = new THREE.Group();
  root.add(figure);
  const lit = litMaterial();
  const glow = glowMaterial();
  const geometries: THREE.BufferGeometry[] = [];
  const groups = new Map<Part, THREE.Group>();

  const groupFor = (part: Part): THREE.Group => {
    const existing = groups.get(part);
    if (existing) return existing;
    const group = new THREE.Group();
    const parent = PARENT[part];
    const pivot = model.pivots[part] ?? [0, 0, 0];
    const parentPivot = parent ? (model.pivots[parent] ?? [0, 0, 0]) : [0, 0, 0];
    group.position.set(pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]);
    group.rotation.set(...(model.poses[part] ?? [0, 0, 0]));
    (parent ? groupFor(parent) : part === 'base' ? root : figure).add(group);
    groups.set(part, group);
    return group;
  };

  for (const part of PARTS) {
    const boxes = model.boxes.filter((b) => b.part === part);
    if (boxes.length === 0) continue;
    const group = groupFor(part);
    const pivot = model.pivots[part] ?? [0, 0, 0];
    for (const [list, material] of [[boxes.filter((b) => !b.glow), lit], [boxes.filter((b) => b.glow), glow]] as const) {
      const geometry = geometryFor(list, pivot);
      if (!geometry) continue;
      geometries.push(geometry);
      group.add(new THREE.Mesh(geometry, material));
    }
  }
  root.rotation.y = model.yaw;

  return {
    root, figure, groups, model,
    dispose() {
      geometries.forEach((g) => g.dispose());
      lit.dispose();
      glow.dispose();
    },
  };
}

/** Pose animate: respiro, sguardo, braccia, coda, ali, ammiccare, scintille. */
function animateParts(built: BuiltAvatar, t: number) {
  const { model, groups, figure } = built;
  const pose = (p: Part) => model.poses[p] ?? [0, 0, 0];
  figure.position.y = (Math.sin(t * 2.2) * 0.5 + 0.5) * model.bob;
  const set = (p: Part, dx: number, dy: number, dz: number) => {
    const g = groups.get(p);
    if (!g) return;
    const [x, y, z] = pose(p);
    g.rotation.set(x + dx, y + dy, z + dz);
  };
  set('head', Math.sin(t * 1.3) * 0.04, Math.sin(t * 0.9) * 0.12, 0);
  set('armL', Math.sin(t * 2.2) * 0.08, 0, 0);
  set('armR', -Math.sin(t * 2.2) * 0.08, 0, 0);
  set('tail', 0, Math.sin(t * 3) * 0.3, 0);
  set('wingL', 0, 0, -Math.sin(t * 3.4) * 0.22);
  set('wingR', 0, 0, Math.sin(t * 3.4) * 0.22);
  set('fx', 0, t * 0.8, 0);
  const eyesGroup = groups.get('eyes');
  if (eyesGroup) eyesGroup.scale.y = t % 3.6 < 0.13 ? 0.15 : 1;
}

export interface AvatarHandle {
  update(avatarId: number, level: number): void;
  dispose(): void;
}

export interface MountOptions {
  avatarId: number;
  level: number;
  /** Trascinamento orizzontale per girare la figura. */
  interactive?: boolean;
  /** false con prefers-reduced-motion: niente animazioni, si ridisegna solo trascinando. */
  animate?: boolean;
  onFirstFrame?: () => void;
}

export function mountAvatar(canvas: HTMLCanvasElement, opts: MountOptions): AvatarHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = makeScene();
  const camera = makeCamera();
  const animate = opts.animate !== false;

  let avatarId = opts.avatarId;
  let built = buildObject(buildAvatar(avatarId, opts.level));
  scene.add(built.root);

  let aspect = 1;
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    aspect = w / h;
    applyFrame(camera, fullFrame(avatarId), aspect);
    dirty = true;
  };

  let userYaw = 0;
  let dragging = false;
  let lastX = 0;
  let lastInteraction = -Infinity;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    userYaw = Math.max(-YAW_RANGE, Math.min(YAW_RANGE, userYaw + (e.clientX - lastX) * 0.012));
    lastX = e.clientX;
    lastInteraction = performance.now();
    dirty = true;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    lastInteraction = performance.now();
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  if (opts.interactive) {
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let dirty = true;
  let first = true;
  let frame = 0;
  const start = performance.now();
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (!visible || document.hidden || (!animate && !dirty)) return;
    const t = (now - start) / 1000;
    // dopo un trascinamento la figura torna piano alla vista di 3/4
    if (!dragging && now - lastInteraction > 1500) userYaw *= 0.95;
    const sway = animate ? Math.sin(t * 0.6) * 0.18 : 0;
    built.root.rotation.y = built.model.yaw + Math.max(-YAW_RANGE, Math.min(YAW_RANGE, userYaw + sway));
    if (animate) animateParts(built, t);
    renderer.render(scene, camera);
    dirty = false;
    if (first) {
      first = false;
      opts.onFirstFrame?.();
    }
  };
  resize();
  frame = requestAnimationFrame(loop);

  return {
    update(id, level) {
      scene.remove(built.root);
      built.dispose();
      avatarId = id;
      built = buildObject(buildAvatar(id, level));
      scene.add(built.root);
      applyFrame(camera, fullFrame(avatarId), aspect);
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      scene.remove(built.root);
      built.dispose();
      // niente forceContextLoss: React può rimontare sullo stesso canvas
      renderer.dispose();
    },
  };
}

/**
 * Renderer per le immagini statiche (scripts/render-avatars.mjs): un solo
 * contesto WebGL per tutte le 200 immagini, posa di riposo, sfondo trasparente.
 */
export function createStillRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = makeScene();
  const camera = makeCamera();
  return (avatarId: number, level: number, framing: Framing, size: number) => {
    renderer.setSize(size, size, false);
    const model = buildAvatar(avatarId, level);
    const built = buildObject(model);
    scene.add(built.root);
    applyFrame(camera, framing === 'face' ? faceFrame(model) : fullFrame(avatarId));
    renderer.render(scene, camera);
    scene.remove(built.root);
    built.dispose();
  };
}

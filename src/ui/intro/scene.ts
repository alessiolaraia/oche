// 3D-Intro (Three.js, wird nur fürs Intro nachgeladen): Board an der Wand im Spotlicht, drei Pfeile fliegen
// auf einer echten Wurfbahn (Spitze voraus, leichter Bogen, drehende Flights) in die Triple 20 – in Zeitlupe,
// mit Kameraeinstellungen wie im Film: Verfolger, Seitenfahrt, frontal, dann Kreisfahrt um die 180.
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type IntroEvent =
  | { type: 'throw'; n: 1 | 2 | 3 }
  | { type: 'hit'; n: 1 | 2 | 3 }
  | { type: 'maximum' }
  | { type: 'names' }
  | { type: 'out' }
  | { type: 'done' };

/** Zeitplan in Sekunden. */
export const TIMELINE = {
  throws: [1.3, 2.95, 4.6] as const,
  /** sichtbare Flugdauer (Zeitlupe) */
  fly: 1.0,
  maximum: 5.75,
  names: 7.4,
  out: 9.9,
  done: 10.5,
};

// Maße in Metern (Turnier-Board: Ø 451 mm, Abwurflinie 2,37 m)
const R = {
  bull: 0.00635,
  outerBull: 0.0159,
  trebleIn: 0.099,
  trebleOut: 0.107,
  doubleIn: 0.162,
  doubleOut: 0.17,
};
const BOARD_R = 0.2255;
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const T20 = new Vector3(0, 0.103, 0);
const HITS = [
  new Vector3(-0.0085, 0.1036, -0.007),
  new Vector3(0.0006, 0.1022, -0.007),
  new Vector3(0.0096, 0.1043, -0.007),
];
const STARTS = [
  new Vector3(0.075, -0.07, 2.3),
  new Vector3(0.05, -0.06, 2.3),
  new Vector3(0.085, -0.075, 2.3),
];
const APEX = 0.085;
const SPOT = 1.6;
const UP = new Vector3(0, 1, 0);

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Boardfläche als Textur: Segmente, Sisal-Struktur, Drahtspinne, Zahlenring. */
function boardTextures(): { map: CanvasTexture; bump: CanvasTexture } {
  const S = 2048;
  const k = S / 2 / BOARD_R; // Pixel pro Meter
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    g.translate(S / 2, S / 2);
    return { c, g };
  };
  const seg = (g: CanvasRenderingContext2D, r1: number, r2: number, a1: number, a2: number, fill: string) => {
    g.beginPath();
    g.arc(0, 0, r2 * k, a1, a2);
    g.arc(0, 0, r1 * k, a2, a1, true);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const ang = (i: number) => ((i * 18 - 9 - 90) * Math.PI) / 180;

  const { c, g } = make();
  g.fillStyle = '#0c0c0c';
  g.beginPath();
  g.arc(0, 0, BOARD_R * k, 0, Math.PI * 2);
  g.fill();
  ORDER.forEach((_, i) => {
    const dark = i % 2 === 0;
    const single = dark ? '#1b1a19' : '#e9dcbf';
    const ring = dark ? '#c62a28' : '#127a40';
    const a1 = ang(i);
    const a2 = ang(i + 1);
    seg(g, R.outerBull, R.trebleIn, a1, a2, single);
    seg(g, R.trebleIn, R.trebleOut, a1, a2, ring);
    seg(g, R.trebleOut, R.doubleIn, a1, a2, single);
    seg(g, R.doubleIn, R.doubleOut, a1, a2, ring);
  });
  seg(g, 0, R.outerBull, 0, Math.PI * 2, '#127a40');
  seg(g, 0, R.bull, 0, Math.PI * 2, '#c62a28');

  // Sisal: feine Fasern
  for (let n = 0; n < 90000; n++) {
    const r = Math.sqrt(Math.random()) * R.doubleOut * k;
    const a = Math.random() * Math.PI * 2;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    g.fillRect(r * Math.cos(a), r * Math.sin(a), 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Zahlen
  g.fillStyle = '#f2efe8';
  g.font = `700 ${Math.round(0.026 * k)}px "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ORDER.forEach((n, i) => {
    const a = ((i * 18 - 90) * Math.PI) / 180;
    g.fillText(String(n), 0.197 * k * Math.cos(a), 0.197 * k * Math.sin(a));
  });

  // Drahtspinne (silbern) – auch in der Bump-Map, damit sie plastisch steht
  const wires = (ctx: CanvasRenderingContext2D, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const r of [R.outerBull, R.trebleIn, R.trebleOut, R.doubleIn, R.doubleOut]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, R.bull * k, 0, Math.PI * 2);
    ctx.stroke();
    ORDER.forEach((_, i) => {
      const a = ang(i);
      ctx.beginPath();
      ctx.moveTo(R.outerBull * k * Math.cos(a), R.outerBull * k * Math.sin(a));
      ctx.lineTo(R.doubleOut * k * Math.cos(a), R.doubleOut * k * Math.sin(a));
      ctx.stroke();
    });
  };
  wires(g, '#c9ccd2', 4);

  const b = make();
  b.g.fillStyle = '#777';
  b.g.fillRect(-S / 2, -S / 2, S, S);
  for (let n = 0; n < 120000; n++) {
    const r = Math.sqrt(Math.random()) * R.doubleOut * k;
    const a = Math.random() * Math.PI * 2;
    b.g.fillStyle = Math.random() < 0.5 ? '#8a8a8a' : '#646464';
    b.g.fillRect(r * Math.cos(a), r * Math.sin(a), 2, 2);
  }
  wires(b.g, '#fff', 5);

  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new CanvasTexture(b.c);
  return { map, bump };
}

/** Pfeil: Spitze im Ursprung, Körper entlang +Z (zum Werfer). */
function makeDart(
  flight: MeshPhysicalMaterial,
  metal: MeshStandardMaterial,
  steel: MeshStandardMaterial,
  shaftMat: MeshStandardMaterial,
) {
  const body = new Group();
  // Spitze
  const tip = new LatheGeometry(
    [
      new Vector2(0, 0),
      new Vector2(0.0005, 0.0015),
      new Vector2(0.0011, 0.01),
      new Vector2(0.00125, 0.029),
      new Vector2(0.0018, 0.031),
    ],
    24,
  );
  // Barrel mit Rändelung
  const pts = [new Vector2(0.0018, 0.031), new Vector2(0.0031, 0.033)];
  for (let i = 0; i < 10; i++) {
    const y = 0.035 + i * 0.0042;
    pts.push(
      new Vector2(0.0035, y),
      new Vector2(0.003, y + 0.0011),
      new Vector2(0.0035, y + 0.0022),
      new Vector2(0.0035, y + 0.0042),
    );
  }
  pts.push(new Vector2(0.0033, 0.078), new Vector2(0.0024, 0.082), new Vector2(0.002, 0.083));
  const barrel = new LatheGeometry(pts, 40);
  const shaft = new CylinderGeometry(0.0021, 0.0019, 0.034, 20);
  shaft.translate(0, 0.083 + 0.017, 0);
  const ring = new CylinderGeometry(0.0026, 0.0026, 0.002, 20);
  ring.translate(0, 0.106, 0);
  const shape = new Shape();
  shape.moveTo(0.002, 0);
  shape.lineTo(0.0125, 0.011);
  shape.lineTo(0.0165, 0.037);
  shape.lineTo(0.0165, 0.04);
  shape.lineTo(0.002, 0.04);
  shape.closePath();
  const wing = new ShapeGeometry(shape);
  wing.translate(0, 0.104, 0);

  const add = (geo: BufferGeometry, mat: MeshStandardMaterial) => {
    const m = new Mesh(geo, mat);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  add(tip, steel);
  add(barrel, metal);
  add(shaft, shaftMat);
  add(ring, metal);
  for (let q = 0; q < 4; q++) add(wing, flight).rotation.y = (q * Math.PI) / 2 + Math.PI / 4;

  body.rotation.x = Math.PI / 2; // +Y → +Z
  const spin = new Group();
  spin.add(body);
  const dart = new Group();
  dart.add(spin);
  dart.visible = false;
  return { dart, spin };
}

/** Wurfbahn: gerade Linie + leichter Bogen; liefert Position und Flugrichtung. */
function path(n: number, u: number, pos: Vector3, dir: Vector3) {
  const a = STARTS[n]!;
  const b = HITS[n]!;
  pos.lerpVectors(a, b, u).addScaledVector(UP, 4 * APEX * u * (1 - u));
  dir
    .subVectors(b, a)
    .addScaledVector(UP, 4 * APEX * (1 - 2 * u))
    .normalize();
}

export interface IntroScene {
  dispose: () => void;
}

export function createIntroScene(canvas: HTMLCanvasElement, onEvent: (e: IntroEvent) => void): IntroScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.background = new Color('#060606');
  scene.fog = new Fog('#060606', 2.6, 6);
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;

  // Wand, Surround, Board
  const wall = new Mesh(
    new PlaneGeometry(10, 8),
    new MeshStandardMaterial({ color: '#16130f', roughness: 0.95 }),
  );
  wall.position.z = -0.045;
  wall.receiveShadow = true;
  scene.add(wall);
  const surround = new Mesh(
    new RingGeometry(BOARD_R - 0.002, 0.33, 128),
    new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.8 }),
  );
  surround.position.z = -0.012;
  surround.receiveShadow = true;
  scene.add(surround);
  const { map, bump } = boardTextures();
  const face = new Mesh(
    new CircleGeometry(BOARD_R, 160),
    new MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: 0.92, metalness: 0 }),
  );
  face.receiveShadow = true;
  scene.add(face);
  const side = new Mesh(
    new CylinderGeometry(BOARD_R, BOARD_R, 0.038, 128, 1, true),
    new MeshStandardMaterial({ color: '#111', roughness: 0.7 }),
  );
  side.rotation.x = Math.PI / 2;
  side.position.z = -0.019;
  scene.add(side);

  // Licht: Spot von oben vorn (wie ein Board-Licht), kühles Fülllicht, Akzente in Blau/Apricot
  const spot = new SpotLight('#fff3e2', 0, 5, 0.42, 0.75, 1.6);
  spot.position.set(0.05, 0.6, 1.05);
  spot.target.position.set(0, 0.04, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0002;
  spot.shadow.normalBias = 0.0015;
  spot.shadow.camera.near = 0.3;
  spot.shadow.camera.far = 3;
  scene.add(spot, spot.target);
  const hemi = new HemisphereLight('#8ea2c8', '#0b0907', 0.0);
  scene.add(hemi);
  const blue = new PointLight('#3d7bff', 0, 3, 2);
  blue.position.set(-0.9, 0.3, 0.7);
  const apricot = new PointLight('#ff8a3d', 0, 3, 2);
  apricot.position.set(0.9, -0.2, 0.8);
  scene.add(blue, apricot);

  // Pfeile
  const flight = new MeshPhysicalMaterial({
    color: '#5a3dff',
    emissive: '#2a0d6e',
    emissiveIntensity: 0.35,
    roughness: 0.35,
    iridescence: 1,
    iridescenceIOR: 1.6,
    side: DoubleSide,
  });
  const metal = new MeshStandardMaterial({ color: '#c3c7cf', metalness: 1, roughness: 0.26 });
  const steel = new MeshStandardMaterial({ color: '#eceef2', metalness: 1, roughness: 0.12 });
  const shaftMat = new MeshStandardMaterial({ color: '#0e0e10', metalness: 0.5, roughness: 0.3 });
  const darts = [0, 1, 2].map(() => makeDart(flight, metal, steel, shaftMat));
  for (const d of darts) scene.add(d.dart);

  // Sisal-Staub beim Einschlag
  const N = 70;
  const dustPos = new Float32Array(N * 3);
  const dustVel: Vector3[] = Array.from({ length: N }, () => new Vector3());
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  const dustMat = new PointsMaterial({
    color: '#ffd9a6',
    size: 0.0035,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  let dustT = -1;
  const burst = (at: Vector3) => {
    for (let i = 0; i < N; i++) {
      dustPos[i * 3] = at.x;
      dustPos[i * 3 + 1] = at.y;
      dustPos[i * 3 + 2] = 0.002;
      dustVel[i]!.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 0.5, Math.random() * 0.35);
    }
    dustGeo.attributes.position!.needsUpdate = true;
    dustT = 0;
  };

  const camera = new PerspectiveCamera(35, 1, 0.005, 20);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.35, 0.4, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 52 : 34;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Kamera mit Nachführung (weich) und harten Schnitten zwischen den Einstellungen
  const camPos = new Vector3(0.35, 0.22, 2.2);
  const camLook = new Vector3(0, 0, 0);
  const wantPos = new Vector3();
  const wantLook = new Vector3();
  const tmpPos = new Vector3();
  const tmpDir = new Vector3();
  const right = new Vector3();
  let shot = -1;
  let shakeT = -1;

  const fired = new Set<string>();
  const fire = (key: string, e: IntroEvent) => {
    if (fired.has(key)) return;
    fired.add(key);
    onEvent(e);
  };

  const wobble = new Quaternion();
  const baseQ = new Quaternion();
  const Z = new Vector3(0, 0, 1);
  const X = new Vector3(1, 0, 0);
  const back = new Vector3();

  const start = performance.now();
  let last = start;
  let raf = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Debug/Screenshots: feste Zeit über window.__ocheIntroT
    const t = (window as { __ocheIntroT?: number }).__ocheIntroT ?? (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Licht hochfahren
    const on = smooth(clamp01(t / 0.9));
    spot.intensity = SPOT * on;
    hemi.intensity = 0.18 * on;
    blue.intensity = 1.6 * on;
    apricot.intensity = 1.2 * on;

    // Pfeile
    darts.forEach((d, n) => {
      const ts = TIMELINE.throws[n]!;
      if (t < ts) return;
      const nn = (n + 1) as 1 | 2 | 3;
      fire(`throw${n}`, { type: 'throw', n: nn });
      const u = clamp01((t - ts) / TIMELINE.fly);
      path(n, u, tmpPos, tmpDir);
      d.dart.visible = true;
      d.dart.position.copy(tmpPos);
      back.copy(tmpDir).negate();
      baseQ.setFromUnitVectors(Z, back);
      d.spin.rotation.z = u * Math.PI * 3 + n;
      if (u >= 1) {
        const tau = t - ts - TIMELINE.fly;
        if (!fired.has(`hit${n}`)) {
          burst(HITS[n]!);
          shakeT = t;
        }
        fire(`hit${n}`, { type: 'hit', n: nn });
        // Nachfedern um die Spitze
        wobble.setFromAxisAngle(X, 0.06 * Math.exp(-7 * tau) * Math.sin(38 * tau));
        d.dart.quaternion.copy(baseQ).multiply(wobble);
      } else {
        d.dart.quaternion.copy(baseQ);
      }
    });

    // Kameraeinstellungen
    const [t1, t2, t3] = TIMELINE.throws;
    let k: number;
    let nextShot = 0;
    if (t < t1) {
      const e = smooth(clamp01(t / t1));
      wantPos.set(MathUtils.lerp(0.35, 0.1, e), MathUtils.lerp(0.22, 0.04, e), MathUtils.lerp(2.2, 2.62, e));
      wantLook.set(0, MathUtils.lerp(0, 0.05, e), 0);
      k = 30;
    } else if (t < t2) {
      // 1: Verfolger hinter dem Pfeil
      nextShot = 1;
      const u = clamp01((t - t1) / TIMELINE.fly);
      if (u < 1) {
        path(0, u, tmpPos, tmpDir);
        right.crossVectors(tmpDir, UP).normalize();
        wantPos
          .copy(tmpPos)
          .addScaledVector(tmpDir, -0.36)
          .addScaledVector(UP, 0.05)
          .addScaledVector(right, 0.015);
        // Blick wandert vom Pfeil aufs Ziel
        wantLook
          .copy(tmpPos)
          .addScaledVector(tmpDir, 0.3)
          .lerp(T20, smooth(u) * 0.6);
        k = 28;
      } else {
        wantPos.set(0.06, 0.15, 0.36);
        wantLook.copy(T20);
        k = 3.5;
      }
    } else if (t < t3) {
      // 2: Seitenfahrt – man sieht, wie gerade er fliegt
      nextShot = 2;
      const u = clamp01((t - t2) / TIMELINE.fly);
      path(1, u, tmpPos, tmpDir);
      if (u < 1) {
        // Hochformat: weiter weg, damit der ganze Pfeil ins schmale Bild passt
        wantPos.set(camera.aspect < 1 ? 0.7 : 0.46, 0.07, tmpPos.z * 0.85 + 0.12);
        wantLook.copy(tmpPos).addScaledVector(tmpDir, -0.05);
        k = 14;
      } else {
        wantPos.set(0.3, 0.17, 0.3);
        wantLook.copy(T20);
        k = 3;
      }
    } else if (t < TIMELINE.maximum) {
      // 3: frontal – der Pfeil kommt auf uns zu
      nextShot = 3;
      const u = clamp01((t - t3) / TIMELINE.fly);
      path(2, u, tmpPos, tmpDir);
      // tief neben der Flugbahn: der Pfeil zieht dicht an der Kamera vorbei ins Board
      wantPos.set(0.15, 0.0, 0.85);
      wantLook.set(-0.01, 0.1, 0);
      k = 5;
    } else {
      // 180: langsame Kreisfahrt um die drei Pfeile
      nextShot = 4;
      fire('max', { type: 'maximum' });
      const th = -0.42 + 0.11 * (t - TIMELINE.maximum);
      wantPos.set(Math.sin(th) * 0.3, 0.135, Math.cos(th) * 0.3);
      wantLook.set(0.001, 0.1, 0);
      k = 20;
    }
    if (t >= TIMELINE.names) fire('names', { type: 'names' });
    if (t >= TIMELINE.out) fire('out', { type: 'out' });
    if (t >= TIMELINE.done) fire('done', { type: 'done' });

    if (nextShot !== shot) {
      // harter Schnitt
      camPos.copy(wantPos);
      camLook.copy(wantLook);
      shot = nextShot;
    } else {
      const a = 1 - Math.exp(-k * dt);
      camPos.lerp(wantPos, a);
      camLook.lerp(wantLook, a);
    }
    camera.position.copy(camPos);
    if (shakeT >= 0) {
      const s = 0.0035 * Math.exp(-(t - shakeT) * 11);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(camLook);

    // Staub
    if (dustT >= 0) {
      dustT += dt;
      for (let i = 0; i < N; i++) {
        const v = dustVel[i]!;
        v.y -= 0.6 * dt;
        dustPos[i * 3] = dustPos[i * 3]! + v.x * dt;
        dustPos[i * 3 + 1] = dustPos[i * 3 + 1]! + v.y * dt;
        dustPos[i * 3 + 2] = dustPos[i * 3 + 2]! + v.z * dt;
      }
      dustGeo.attributes.position!.needsUpdate = true;
      dustMat.opacity = Math.max(0, 0.9 - dustT * 1.3);
    }

    // Blinken der Bloom-Stärke beim 180-Moment
    bloom.strength = 0.35 + (t > TIMELINE.maximum ? 0.5 * Math.exp(-(t - TIMELINE.maximum) * 2.5) : 0);
    composer.render();
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o: Object3D) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      map.dispose();
      bump.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

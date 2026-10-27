import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  DoubleSide,
  RingGeometry,
  BoxGeometry,
  Group,
  CylinderGeometry,
  ConeGeometry,
  SphereGeometry,
  Vector3,
  Float32BufferAttribute,
  FogExp2,
  Clock,
  LineSegments,
  LineBasicMaterial,
  CatmullRomCurve3,
  TubeGeometry,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Config, PhysicsState, Vec2D } from '../types/index';
import * as V from '../physics/vec';
import { AnimatedWater } from './water-shader';
import { UnderwaterTerrain } from './terrain';
import { FishSystem } from './fish-system';
import { WindParticles } from './wind-particles';
import { SkyDome } from './sky';

// ─── Text label sprite for arrows ───
function makeTextSprite(text: string, hexColor: number): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  // Background pill
  ctx.fillStyle = 'rgba(2, 10, 24, 0.75)';
  ctx.beginPath();
  ctx.roundRect(2, 2, 252, 44, 10);
  ctx.fill();

  // Border
  const hex = '#' + hexColor.toString(16).padStart(6, '0');
  ctx.strokeStyle = hex;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, 252, 44, 10);
  ctx.stroke();

  // Color dot
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(20, 24, 6, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#d0dce8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 34, 24);

  const texture = new CanvasTexture(canvas);
  const mat = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true,
  });
  const sprite = new Sprite(mat);
  sprite.scale.set(4, 0.75, 1);
  return sprite;
}

// ─── Custom 3D Force Arrow ───
class ForceArrow {
  group: Group;
  private shaft: Mesh;
  private head: Mesh;
  label: Sprite | null = null;

  constructor(color: number, emissive: number = 0x000000, labelText?: string) {
    this.group = new Group();
    const sMat = new MeshStandardMaterial({
      color, emissive: emissive || color, emissiveIntensity: 0.25,
      roughness: 0.4, metalness: 0.2,
    });
    const hMat = new MeshStandardMaterial({
      color, emissive: emissive || color, emissiveIntensity: 0.4,
      roughness: 0.3, metalness: 0.3,
    });
    this.shaft = new Mesh(new CylinderGeometry(1, 1, 1, 8), sMat);
    this.shaft.position.y = 0.5;
    this.head = new Mesh(new ConeGeometry(1, 1, 8), hMat);
    this.head.position.y = 1;
    this.group.add(this.shaft, this.head);

    if (labelText) {
      this.label = makeTextSprite(labelText, color);
    }
  }

  update(vecMath: Vec2D, scaleFactor: number, minLen = 0.5): void {
    const mag = V.magnitude(vecMath);
    if (mag < 0.1) { this.group.visible = false; if (this.label) this.label.visible = false; return; }
    this.group.visible = true;
    if (this.label) this.label.visible = true;
    const len = Math.max(minLen, mag * scaleFactor);
    this.setLen(len);
    this.pointAlong(new Vector3(vecMath.x, 0, -vecMath.y).normalize());
  }

  updateScalar(dir3: Vector3, magnitude: number, scaleFactor: number, minLen = 0.5): void {
    if (magnitude < 0.1) { this.group.visible = false; if (this.label) this.label.visible = false; return; }
    this.group.visible = true;
    if (this.label) this.label.visible = true;
    this.setLen(Math.max(minLen, magnitude * scaleFactor));
    this.pointAlong(dir3.clone().normalize());
  }

  private setLen(l: number): void {
    const hl = Math.min(l * 0.15, 1.0);
    const hr = Math.min(l * 0.045, 0.35);
    const sl = l - hl;
    const sr = Math.min(l * 0.02, 0.18);
    this.shaft.scale.set(sr, sl, sr);
    this.shaft.position.y = sl / 2;
    this.head.scale.set(hr, hl, hr);
    this.head.position.y = sl + hl / 2;
  }

  private pointAlong(dir: Vector3): void {
    const up = new Vector3(0, 1, 0);
    if (Math.abs(dir.dot(up)) > 0.999) {
      this.group.quaternion.setFromUnitVectors(up, dir.y > 0 ? up : new Vector3(0, -1, 0));
    } else {
      this.group.quaternion.setFromUnitVectors(up, dir);
    }
  }

  setPosition(x: number, y: number, z: number): void { this.group.position.set(x, y, z); }
  setVisible(v: boolean): void { this.group.visible = v; if (this.label) this.label.visible = v; }
}

function unRotate(v: Vec2D, angleDeg: number): Vec2D {
  const r = angleDeg * (Math.PI / 180);
  return {
    x: v.x * Math.cos(r) + v.y * Math.sin(r),
    y: -v.x * Math.sin(r) + v.y * Math.cos(r),
  };
}

// ─── Parametric hull via cross-section lofting ───
function buildLoftedHull(): BufferGeometry {
  const stations = [
    { z: 8.0, halfBeam: 0.04, draft: 0.3, deckY: 2.6, sharp: 0.98 },
    { z: 7.2, halfBeam: 0.35, draft: 0.6, deckY: 2.8, sharp: 0.90 },
    { z: 6.0, halfBeam: 1.00, draft: 1.0, deckY: 3.0, sharp: 0.75 },
    { z: 4.0, halfBeam: 1.80, draft: 1.3, deckY: 3.1, sharp: 0.55 },
    { z: 2.0, halfBeam: 2.50, draft: 1.5, deckY: 3.1, sharp: 0.40 },
    { z: 0.0, halfBeam: 2.90, draft: 1.6, deckY: 3.0, sharp: 0.30 },
    { z:-2.0, halfBeam: 2.80, draft: 1.5, deckY: 2.95, sharp: 0.35 },
    { z:-4.0, halfBeam: 2.40, draft: 1.3, deckY: 2.85, sharp: 0.45 },
    { z:-5.5, halfBeam: 1.70, draft: 1.0, deckY: 2.75, sharp: 0.55 },
    { z:-6.5, halfBeam: 1.10, draft: 0.7, deckY: 2.65, sharp: 0.65 },
    { z:-7.2, halfBeam: 0.55, draft: 0.5, deckY: 2.55, sharp: 0.75 },
    { z:-7.5, halfBeam: 0.50, draft: 0.45, deckY: 2.50, sharp: 0.78 },
  ];

  const circRes = 16;
  const nStations = stations.length;
  const ptsPerStation = circRes * 2 + 1;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const stationPts: Vector3[][] = [];

  for (let si = 0; si < nStations; si++) {
    const s = stations[si];
    const pts: Vector3[] = [];

    for (let ci = 0; ci <= circRes * 2; ci++) {
      const t = ci / (circRes * 2);
      const angle = t * Math.PI; // 0 → π

      // FIX: cos gives proper starboard→keel→port distribution
      // cos(0)=1 (starboard deck), cos(π/2)=0 (keel), cos(π)=-1 (port deck)
      const x = s.halfBeam * Math.cos(angle);

      const rawV = Math.abs(Math.cos(angle));
      const vPow = Math.pow(rawV, 0.5 + s.sharp * 1.5);
      const y = s.deckY * vPow + (-s.draft) * (1 - vPow);

      pts.push(new Vector3(x, y, s.z));
    }
    stationPts.push(pts);
  }

  for (let si = 0; si < nStations; si++) {
    for (let ci = 0; ci < ptsPerStation; ci++) {
      const p = stationPts[si][ci];
      positions.push(p.x, p.y, p.z);
      normals.push(0, 0, 0);
    }
  }

  for (let si = 0; si < nStations - 1; si++) {
    for (let ci = 0; ci < ptsPerStation - 1; ci++) {
      const a = si * ptsPerStation + ci;
      const b = a + 1;
      const c = (si + 1) * ptsPerStation + ci;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Transom cap
  const lastSi = nStations - 1;
  const transomCenter = lastSi * ptsPerStation + circRes;
  for (let ci = 0; ci < ptsPerStation - 1; ci++) {
    const a = lastSi * ptsPerStation + ci;
    const b = a + 1;
    indices.push(transomCenter, a, b);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('normal', new Float32BufferAttribute(new Float32Array(normals), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildDeckGeometry(): BufferGeometry {
  const deckStations = [
    { z: 7.2, halfBeam: 0.30 },
    { z: 6.0, halfBeam: 0.90 },
    { z: 4.0, halfBeam: 1.70 },
    { z: 2.0, halfBeam: 2.40 },
    { z: 0.0, halfBeam: 2.80 },
    { z:-2.0, halfBeam: 2.70 },
    { z:-4.0, halfBeam: 2.30 },
    { z:-5.5, halfBeam: 1.60 },
    { z:-6.5, halfBeam: 1.00 },
    { z:-7.2, halfBeam: 0.50 },
    { z:-7.5, halfBeam: 0.45 },
  ];

  const positions: number[] = [];
  const indices: number[] = [];
  const ptsPerRow = 5;

  for (const s of deckStations) {
    const y = s.z > 5 ? 2.9 : (s.z > 0 ? 3.0 : (s.z > -5 ? 2.95 : 2.7));
    const hb = s.halfBeam;
    positions.push(-hb, y, s.z);
    positions.push(-hb * 0.5, y, s.z);
    positions.push(0, y, s.z);
    positions.push(hb * 0.5, y, s.z);
    positions.push(hb, y, s.z);
  }

  const n = deckStations.length;
  for (let si = 0; si < n - 1; si++) {
    for (let ci = 0; ci < ptsPerRow - 1; ci++) {
      const a = si * ptsPerRow + ci;
      const b = a + 1;
      const c = (si + 1) * ptsPerRow + ci;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createSailGeometry(
  footWidth: number, luffHeight: number, segsX: number, segsY: number,
  maxBillow: number, twistDeg: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const cols = segsX + 1;
  const rows = segsY + 1;

  for (let iy = 0; iy < rows; iy++) {
    const ty = iy / segsY;
    const h = ty * luffHeight;
    const width = footWidth * (1 - ty * 0.85);
    const twistRad = (twistDeg * Math.PI / 180) * ty * ty;

    for (let ix = 0; ix < cols; ix++) {
      const tx = ix / segsX;
      const localX = tx * width;
      const chordFrac = tx;
      const billowProfile = Math.sin(chordFrac * Math.PI) * 4 * chordFrac * (1 - chordFrac);
      const heightFade = Math.sqrt(ty) * (1 - ty * 0.4);
      const billow = maxBillow * billowProfile * heightFade;
      const rx = localX * Math.cos(twistRad) - billow * Math.sin(twistRad);
      const rz = localX * Math.sin(twistRad) + billow * Math.cos(twistRad);
      positions.push(rx, h, rz);
    }
  }

  for (let iy = 0; iy < segsY; iy++) {
    for (let ix = 0; ix < segsX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Legend overlay for 3D view ───
function createLegend(container: HTMLElement): void {
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute; bottom:10px; right:10px;
    background:rgba(2,10,24,0.82);
    border:1px solid rgba(56,189,248,0.2);
    border-radius:8px; padding:8px 12px;
    font:11px/1.7 'JetBrains Mono',monospace;
    color:#b0c4d8; z-index:10; pointer-events:none;
  `;
  const items = [
    { c: '#3b82f6', l: 'True Wind (TW)' },
    { c: '#22d3ee', l: 'Apparent Wind (AW)' },
    { c: '#22c55e', l: 'Drive Force' },
    { c: '#ef4444', l: 'Heel Force' },
    { c: '#6366f1', l: 'Hull Drag' },
    { c: '#f472b6', l: 'Lift (sail/rotor)' },
    { c: '#fb923c', l: 'Drag (sail/rotor)' },
  ];
  el.innerHTML = items.map(i =>
    `<div style="display:flex;align-items:center;gap:6px">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:${i.c};flex-shrink:0"></span>` +
    `<span>${i.l}</span></div>`,
  ).join('');
  container.appendChild(el);
}

export class Scene3DRenderer {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private clock: Clock;

  private boat: Group;
  private sailGrp: Group;
  private rotorGrp: Group;
  private cyl: Mesh;
  private wake: Mesh;
  private wake2: Mesh;

  private twArrow: ForceArrow;
  private awArrow: ForceArrow;
  private driveArrow: ForceArrow;
  private heelArrow: ForceArrow;
  private hullDragArrow: ForceArrow;
  private sLiftArrow: ForceArrow;
  private sDragArrow: ForceArrow;
  private rLiftArrow: ForceArrow;
  private rDragArrow: ForceArrow;

  private animatedWater: AnimatedWater;
  private terrain: UnderwaterTerrain;
  private fishSystem: FishSystem;
  private windParticles: WindParticles;
  private skyDome: SkyDome;

  constructor(container: HTMLElement) {
    this.clock = new Clock();

    // Blue-tinted scene to match sky/water
    this.scene = new Scene();
    this.scene.background = new Color('#0a1e38');
    this.scene.fog = new FogExp2(0x1a3858, 0.0025);

    this.camera = new PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1200);
    this.camera.position.set(18, 10, 18);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.sortObjects = true;
    container.appendChild(this.renderer.domElement);

    // Touch support: CSS touch-action on element + container
    const domEl = this.renderer.domElement;
    domEl.style.touchAction = 'none';
    container.style.touchAction = 'none';

    // ─── Camera controls — full zoom, pitch, orbit + touch ───
    // IMPORTANT: OrbitControls must be created BEFORE any manual event listeners
    // so it can register its own pointer/wheel handlers first
    this.controls = new OrbitControls(this.camera, domEl);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.panSpeed = 0.8;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 1.2;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 200;
    this.controls.target.set(0, 2, 0);
    this.controls.screenSpacePanning = true;

    // Prevent browser page-level zoom/scroll AFTER OrbitControls is set up
    // (OrbitControls uses pointer events, these are touch/wheel fallbacks)
    domEl.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault(); // only block Ctrl+wheel (browser zoom)
    }, { passive: false });
    domEl.addEventListener('gesturestart', (e: Event) => { e.preventDefault(); }, { passive: false } as any);
    domEl.addEventListener('gesturechange', (e: Event) => { e.preventDefault(); }, { passive: false } as any);

    // ─── Lighting ───
    this.scene.add(new HemisphereLight(0x6ab8d0, 0x0a2030, 0.7));
    this.scene.add(new AmbientLight(0xffffff, 0.25));

    const sun = new DirectionalLight(0xffeedd, 1.2);
    sun.position.set(40, 60, 30);
    this.scene.add(sun);

    const backFill = new DirectionalLight(0x4488cc, 0.35);
    backFill.position.set(-30, 20, -40);
    this.scene.add(backFill);

    const rimLight = new DirectionalLight(0x88aacc, 0.2);
    rimLight.position.set(0, 5, -50);
    this.scene.add(rimLight);

    const underwaterPt = new PointLight(0x06d6a0, 0.5, 60);
    underwaterPt.position.set(0, -2, 0);
    this.scene.add(underwaterPt);

    // ─── Environment ───
    this.skyDome = new SkyDome();
    this.scene.add(this.skyDome.mesh);

    this.terrain = new UnderwaterTerrain(500, 64);
    this.scene.add(this.terrain.mesh);

    this.animatedWater = new AnimatedWater(500, 128);
    this.scene.add(this.animatedWater.mesh);

    this.fishSystem = new FishSystem(200);
    this.scene.add(this.fishSystem.mesh);

    this.windParticles = new WindParticles(500);
    this.scene.add(this.windParticles.points);

    // Compass ring + N marker
    const rose = new Mesh(
      new RingGeometry(20, 21.5, 64),
      new MeshBasicMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.35, side: DoubleSide }),
    );
    rose.rotation.x = -Math.PI / 2;
    rose.position.y = -0.3;
    this.scene.add(rose);

    const nMarker = new Mesh(
      new BoxGeometry(0.8, 0.5, 3),
      new MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.3 }),
    );
    nMarker.position.set(0, -0.2, -21);
    this.scene.add(nMarker);

    // ─── Wake ───
    const mkWake = (spread: number, len: number, op: number): Mesh => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(
        new Float32Array([0, 0, 0, -spread, 0, len, spread, 0, len]), 3));
      return new Mesh(g, new MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: op, side: DoubleSide,
      }));
    };
    this.wake = mkWake(3, 12, 0.18);
    this.wake.position.y = 0.05;
    this.scene.add(this.wake);
    this.wake2 = mkWake(5.5, 20, 0.08);
    this.wake2.position.y = 0.03;
    this.scene.add(this.wake2);

    // ═══════════════════════════════════════
    // BOAT — Parametric lofted hull yacht
    // ═══════════════════════════════════════
    this.boat = new Group();
    this.scene.add(this.boat);

    // ─── Hull (lofted cross-sections) ───
    const hullGeo = buildLoftedHull();
    const hullMat = new MeshPhysicalMaterial({
      color: 0xf0f4f8,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      side: DoubleSide,
    });
    this.boat.add(new Mesh(hullGeo, hullMat));

    // Bottom (antifouling)
    const bottomGeo = buildLoftedHull();
    const bottomPos = bottomGeo.attributes.position;
    for (let i = 0; i < bottomPos.count; i++) {
      if (bottomPos.getY(i) > 0.2) bottomPos.setY(i, 0.2);
    }
    bottomGeo.computeVertexNormals();
    const bottomMat = new MeshStandardMaterial({
      color: 0x2a0a0a, roughness: 0.6, metalness: 0.05, side: DoubleSide,
    });
    this.boat.add(new Mesh(bottomGeo, bottomMat));

    // ─── Deck ───
    const deckGeo = buildDeckGeometry();
    const deck = new Mesh(deckGeo, new MeshStandardMaterial({
      color: 0xb8935a, roughness: 0.75, metalness: 0.02, side: DoubleSide,
    }));
    this.boat.add(deck);

    // Deck planking lines
    const plankLines: number[] = [];
    for (let pz = -6.5; pz < 7; pz += 0.8) {
      plankLines.push(-2.2, 3.02, pz, 2.2, 3.02, pz);
    }
    if (plankLines.length > 0) {
      const plankGeo = new BufferGeometry();
      plankGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(plankLines), 3));
      this.boat.add(new LineSegments(plankGeo,
        new LineBasicMaterial({ color: 0x8a6830, transparent: true, opacity: 0.3 })));
    }

    // ─── Cabin / Coach roof ───
    const cabGeo = new BoxGeometry(2.6, 1.1, 5.0, 4, 2, 4);
    const cabPos = cabGeo.attributes.position;
    for (let i = 0; i < cabPos.count; i++) {
      const cx = cabPos.getX(i);
      const cy = cabPos.getY(i);
      if (cy > 0) {
        const nx = cx / 1.3;
        cabPos.setY(i, cy * (1 - nx * nx * 0.15));
      }
      const cz = cabPos.getZ(i);
      if (Math.abs(cz) > 2.2 && Math.abs(cx) > 1.0) {
        cabPos.setX(i, cx * 0.85);
      }
    }
    cabGeo.computeVertexNormals();
    const cabin = new Mesh(cabGeo, new MeshPhysicalMaterial({
      color: 0xc0c8d0, roughness: 0.25, metalness: 0.1,
      clearcoat: 0.4, clearcoatRoughness: 0.2,
    }));
    cabin.position.set(0, 3.55, 0.5);
    this.boat.add(cabin);

    // Cabin windows
    const win = new Mesh(
      new BoxGeometry(2.66, 0.4, 4.2),
      new MeshPhysicalMaterial({
        color: 0x0a1520, roughness: 0.05, metalness: 0.6,
        clearcoat: 1.0, clearcoatRoughness: 0.05,
      }),
    );
    win.position.set(0, 3.7, 0.5);
    this.boat.add(win);

    // ─── Cockpit ───
    const cockpitFloor = new Mesh(
      new BoxGeometry(2.0, 0.1, 3.2),
      new MeshStandardMaterial({ color: 0xa88040, roughness: 0.8 }),
    );
    cockpitFloor.position.set(0, 2.55, -4.8);
    this.boat.add(cockpitFloor);

    const coamMat = new MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.4, metalness: 0.05 });
    const coamL = new Mesh(new BoxGeometry(0.15, 0.5, 3.2), coamMat);
    coamL.position.set(-1.1, 2.85, -4.8);
    this.boat.add(coamL);
    const coamR = new Mesh(new BoxGeometry(0.15, 0.5, 3.2), coamMat);
    coamR.position.set(1.1, 2.85, -4.8);
    this.boat.add(coamR);

    // Helm wheel
    const wheelGeo = new CylinderGeometry(0.35, 0.35, 0.04, 24);
    wheelGeo.rotateX(Math.PI * 0.3);
    const wheel = new Mesh(wheelGeo, new MeshStandardMaterial({
      color: 0x4a3520, roughness: 0.6, metalness: 0.2,
    }));
    wheel.position.set(0, 3.2, -5.8);
    this.boat.add(wheel);
    for (let i = 0; i < 6; i++) {
      const spokeGeo = new CylinderGeometry(0.015, 0.015, 0.7, 4);
      const spoke = new Mesh(spokeGeo, new MeshStandardMaterial({ color: 0x5a4530 }));
      spoke.rotation.z = (Math.PI / 3) * i;
      spoke.position.copy(wheel.position);
      spoke.rotation.x = Math.PI * 0.3;
      this.boat.add(spoke);
    }

    // ─── Keel fin ───
    const keelGeo = new BoxGeometry(0.22, 3.8, 2.8, 2, 4, 2);
    const keelVerts = keelGeo.attributes.position;
    for (let i = 0; i < keelVerts.count; i++) {
      const ky = keelVerts.getY(i);
      const kz = keelVerts.getZ(i);
      if (ky < 0) {
        const t = Math.abs(ky) / 1.9;
        keelVerts.setX(i, keelVerts.getX(i) * (1 - t * 0.4));
        keelVerts.setZ(i, kz * (1 + t * 0.2));
      }
      const chordPos = (kz + 1.4) / 2.8;
      const thickness = 4 * chordPos * (1 - chordPos);
      keelVerts.setX(i, keelVerts.getX(i) * (0.3 + thickness * 0.7));
    }
    keelGeo.computeVertexNormals();
    const keel = new Mesh(keelGeo, new MeshStandardMaterial({
      color: 0x1a3a5c, roughness: 0.4, metalness: 0.3,
    }));
    keel.position.set(0, -2.9, 0.5);
    this.boat.add(keel);

    // Keel bulb
    const bulbGeo = new SphereGeometry(0.65, 16, 12);
    bulbGeo.scale(0.5, 0.3, 1.4);
    const bulb = new Mesh(bulbGeo, new MeshStandardMaterial({
      color: 0x2a5070, roughness: 0.35, metalness: 0.4,
    }));
    bulb.position.set(0, -4.8, 0.5);
    this.boat.add(bulb);

    // ─── Rudder ───
    const rudGeo = new BoxGeometry(0.1, 2.4, 1.0, 1, 3, 1);
    const rudVerts = rudGeo.attributes.position;
    for (let i = 0; i < rudVerts.count; i++) {
      const rz = rudVerts.getZ(i);
      const cp = (rz + 0.5) / 1.0;
      const th = 4 * cp * (1 - cp);
      rudVerts.setX(i, rudVerts.getX(i) * (0.3 + th * 0.7));
    }
    rudGeo.computeVertexNormals();
    const rud = new Mesh(rudGeo, new MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.2 }));
    rud.position.set(0, -0.5, -7.4);
    this.boat.add(rud);

    // ─── Lifelines / Stanchions ───
    const stanchionMat = new MeshStandardMaterial({ color: 0xa0aab4, metalness: 0.6, roughness: 0.3 });
    const stanchionPositions = [
      { x: 2.5, z: 1 }, { x: 2.3, z: 3 }, { x: 1.8, z: 5 },
      { x: -2.5, z: 1 }, { x: -2.3, z: 3 }, { x: -1.8, z: 5 },
      { x: 2.6, z: -1 }, { x: 2.4, z: -3 },
      { x: -2.6, z: -1 }, { x: -2.4, z: -3 },
    ];
    for (const sp of stanchionPositions) {
      const sg = new CylinderGeometry(0.025, 0.025, 1.0, 4);
      const sm = new Mesh(sg, stanchionMat);
      sm.position.set(sp.x, 3.5, sp.z);
      this.boat.add(sm);
    }

    // Lifelines
    const wireLines: number[] = [];
    wireLines.push(
      1.8, 3.95, 5, 2.3, 3.95, 3, 2.3, 3.95, 3, 2.5, 3.95, 1,
      2.5, 3.95, 1, 2.6, 3.95, -1, 2.6, 3.95, -1, 2.4, 3.95, -3,
      -1.8, 3.95, 5, -2.3, 3.95, 3, -2.3, 3.95, 3, -2.5, 3.95, 1,
      -2.5, 3.95, 1, -2.6, 3.95, -1, -2.6, 3.95, -1, -2.4, 3.95, -3,
    );
    const wireGeo = new BufferGeometry();
    wireGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(wireLines), 3));
    this.boat.add(new LineSegments(wireGeo,
      new LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.5 })));

    // ─── Bow pulpit rail ───
    const bowPts = [
      new Vector3(1.5, 3.9, 4), new Vector3(0.8, 4.0, 6.5),
      new Vector3(0, 4.0, 7.5), new Vector3(-0.8, 4.0, 6.5),
      new Vector3(-1.5, 3.9, 4),
    ];
    const bowRailGeo = new TubeGeometry(new CatmullRomCurve3(bowPts), 20, 0.035, 6, false);
    this.boat.add(new Mesh(bowRailGeo, stanchionMat));

    // Stern pushpit
    const sternPts = [
      new Vector3(1.2, 3.5, -5.5), new Vector3(0.8, 3.5, -6.5),
      new Vector3(0, 3.5, -6.8), new Vector3(-0.8, 3.5, -6.5),
      new Vector3(-1.2, 3.5, -5.5),
    ];
    const sternRailGeo = new TubeGeometry(new CatmullRomCurve3(sternPts), 16, 0.035, 6, false);
    this.boat.add(new Mesh(sternRailGeo, stanchionMat));

    // ═══════════════════════════════════════
    // SAIL GROUP
    // ═══════════════════════════════════════
    this.sailGrp = new Group();
    this.boat.add(this.sailGrp);

    const mastMat = new MeshStandardMaterial({ color: 0x404858, metalness: 0.5, roughness: 0.4 });
    const mast = new Mesh(new CylinderGeometry(0.08, 0.14, 19, 8), mastMat);
    mast.position.y = 9.5 + 3;
    this.sailGrp.add(mast);

    // Spreaders
    const spreaderMat = new MeshStandardMaterial({ color: 0x506070, metalness: 0.4, roughness: 0.5 });
    for (const sh of [10, 15]) {
      const sprGeo = new CylinderGeometry(0.025, 0.025, 3.5, 4);
      sprGeo.rotateZ(Math.PI / 2);
      const spr = new Mesh(sprGeo, spreaderMat);
      spr.position.set(0, sh, 0);
      this.sailGrp.add(spr);
    }

    // Boom
    const boomGeo = new CylinderGeometry(0.05, 0.06, 7, 6);
    boomGeo.rotateX(Math.PI / 2);
    const boom = new Mesh(boomGeo, mastMat);
    boom.position.set(0, 3.5, 3.5);
    this.sailGrp.add(boom);

    // Mainsail
    const sailGeo = createSailGeometry(5.5, 15, 14, 18, 2.0, 12);
    const sailMesh = new Mesh(sailGeo, new MeshPhysicalMaterial({
      color: 0xfaf0d8, side: DoubleSide, transparent: true, opacity: 0.92,
      roughness: 0.65, metalness: 0.0, emissive: 0xfde047, emissiveIntensity: 0.02,
    }));
    sailMesh.position.set(0, 3.5, 0);
    this.sailGrp.add(sailMesh);

    // Rigging
    const rigGeo = new BufferGeometry();
    rigGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array([
      0, 22, 0, 0, 3.2, 7.5,
      0, 22, 0, 0, 3.2, -6.5,
      0, 22, 0, 2.8, 3.2, 0,
      0, 22, 0, -2.8, 3.2, 0,
      0, 15, 0, 2.6, 3.2, 1.5,
      0, 15, 0, -2.6, 3.2, 1.5,
      0, 15, 0, 2.6, 3.2, -1.0,
      0, 15, 0, -2.6, 3.2, -1.0,
    ]), 3));
    this.sailGrp.add(new LineSegments(rigGeo,
      new LineBasicMaterial({ color: 0x5a7a9e, transparent: true, opacity: 0.4 })));

    // ═══════════════════════════════════════
    // ROTOR GROUP
    // ═══════════════════════════════════════
    this.rotorGrp = new Group();
    this.boat.add(this.rotorGrp);

    this.cyl = new Mesh(
      new CylinderGeometry(0.35, 0.35, 1, 24),
      new MeshStandardMaterial({ color: 0xfdba74, roughness: 0.5, emissive: 0xea580c, emissiveIntensity: 0.1 }),
    );
    this.rotorGrp.add(this.cyl);
    const capGeo = new CylinderGeometry(0.5, 0.5, 0.08, 24);
    const capMat = new MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.2 });
    const topCap = new Mesh(capGeo, capMat);
    topCap.position.y = 0.5;
    this.cyl.add(topCap);
    const botCap = new Mesh(capGeo, capMat);
    botCap.position.y = -0.5;
    this.cyl.add(botCap);
    for (let i = 0; i < 4; i++) {
      const rib = new Mesh(new BoxGeometry(0.06, 1, 0.7), new MeshStandardMaterial({ color: 0xea580c }));
      rib.rotation.y = (Math.PI / 4) * i;
      this.cyl.add(rib);
    }

    // ═══════════════════════════════════════
    // FORCE ARROWS + LABELS
    // ═══════════════════════════════════════
    this.twArrow = new ForceArrow(0x3b82f6, 0x1e40af, 'True Wind');
    this.twArrow.setPosition(0, 12, 0);
    this.scene.add(this.twArrow.group);
    if (this.twArrow.label) { this.twArrow.label.position.set(0, 11, 2); this.scene.add(this.twArrow.label); }

    this.awArrow = new ForceArrow(0x22d3ee, 0x0891b2, 'Apparent Wind');
    this.awArrow.setPosition(0, 5, 7);
    this.boat.add(this.awArrow.group);
    if (this.awArrow.label) { this.awArrow.label.position.set(0, 4, 9); this.boat.add(this.awArrow.label); }

    this.driveArrow = new ForceArrow(0x22c55e, 0x16a34a, 'Drive');
    this.driveArrow.setPosition(0, 5, 1);
    this.boat.add(this.driveArrow.group);
    if (this.driveArrow.label) { this.driveArrow.label.position.set(0, 4, 1); this.boat.add(this.driveArrow.label); }

    this.heelArrow = new ForceArrow(0xef4444, 0xdc2626, 'Heel');
    this.heelArrow.setPosition(0, 5, -1);
    this.boat.add(this.heelArrow.group);
    if (this.heelArrow.label) { this.heelArrow.label.position.set(0, 4, -1); this.boat.add(this.heelArrow.label); }

    this.hullDragArrow = new ForceArrow(0x6366f1, 0x4338ca, 'Hull Drag');
    this.hullDragArrow.setPosition(0, -1, 0);
    this.boat.add(this.hullDragArrow.group);
    if (this.hullDragArrow.label) { this.hullDragArrow.label.position.set(0, -2, 0); this.boat.add(this.hullDragArrow.label); }

    this.sLiftArrow = new ForceArrow(0xf472b6, 0xdb2777, 'Sail Lift');
    this.sLiftArrow.setPosition(0, 10, 0);
    this.sailGrp.add(this.sLiftArrow.group);
    if (this.sLiftArrow.label) { this.sLiftArrow.label.position.set(0, 9, 0); this.sailGrp.add(this.sLiftArrow.label); }

    this.sDragArrow = new ForceArrow(0xfb923c, 0xea580c, 'Sail Drag');
    this.sDragArrow.setPosition(0, 10, 0);
    this.sailGrp.add(this.sDragArrow.group);
    if (this.sDragArrow.label) { this.sDragArrow.label.position.set(2, 9, 0); this.sailGrp.add(this.sDragArrow.label); }

    this.rLiftArrow = new ForceArrow(0xf472b6, 0xdb2777, 'Rotor Lift');
    this.rLiftArrow.setPosition(0, 6, 0);
    this.rotorGrp.add(this.rLiftArrow.group);
    if (this.rLiftArrow.label) { this.rLiftArrow.label.position.set(0, 5, 0); this.rotorGrp.add(this.rLiftArrow.label); }

    this.rDragArrow = new ForceArrow(0xfb923c, 0xea580c, 'Rotor Drag');
    this.rDragArrow.setPosition(0, 6, 0);
    this.rotorGrp.add(this.rDragArrow.group);
    if (this.rDragArrow.label) { this.rDragArrow.label.position.set(2, 5, 0); this.rotorGrp.add(this.rDragArrow.label); }

    // ─── Legend overlay ───
    createLegend(container);

    // ─── Resize ───
    let rt: number;
    this.observer = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = window.setTimeout(() => this.resize(container), 0);
    });
    this.observer.observe(container);
  }

  private resize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  setMode(mode: Config['mode']): void {
    this.sailGrp.visible = mode === 'sail' || mode === 'hybrid';
    this.rotorGrp.visible = mode === 'rotor' || mode === 'hybrid';
    this.sLiftArrow.setVisible(this.sailGrp.visible);
    this.sDragArrow.setVisible(this.sailGrp.visible);
    this.rLiftArrow.setVisible(this.rotorGrp.visible);
    this.rDragArrow.setVisible(this.rotorGrp.visible);
    this.sailGrp.position.z = 0;
    this.rotorGrp.position.z = 0;
  }

  update(cfg: Config, phys: PhysicsState, dt: number): void {
    const elapsed = this.clock.getElapsedTime();

    // Environment
    this.animatedWater.update();
    this.animatedWater.setWindDirection(cfg.twd, cfg.tws);
    this.terrain.update(elapsed);
    this.fishSystem.update(dt);
    this.windParticles.setWindDirection(cfg.twd, cfg.tws);
    this.windParticles.update(dt);

    // Boat heading + heel
    this.boat.rotation.y = -cfg.hdg * (Math.PI / 180);
    const mastH = 10;
    const heelingM = phys.heelN * mastH;
    const rightingM = cfg.mass * 9.81 * 0.35;
    const heelRad = rightingM > 0
      ? Math.asin(Math.min(1, Math.max(-1, heelingM / rightingM)))
      : 0;
    this.boat.rotation.z = heelRad * 0.5;

    this.sailGrp.rotation.y = -cfg.sang * (Math.PI / 180);

    // Rotor
    if (this.rotorGrp.visible) {
      this.cyl.rotation.y -= (cfg.rpm * 2 * Math.PI / 60) * dt;
      const rScale = Math.min(cfg.rh, 8);
      this.cyl.scale.set(1, rScale, 1);
      this.cyl.position.y = rScale / 2 + 3.5;
      this.rLiftArrow.setPosition(0, rScale / 2 + 3.5, 0);
      this.rDragArrow.setPosition(0, rScale / 2 + 3.5, 0);
    }

    // Wake
    this.wake.rotation.y = this.boat.rotation.y;
    const wk = Math.max(0, (cfg.bs - 2) / 5);
    this.wake.scale.set(wk, 1, wk * 2);
    this.wake.visible = cfg.bs > 2;
    this.wake2.rotation.y = this.boat.rotation.y;
    const wk2 = Math.max(0, (cfg.bs - 5) / 4);
    this.wake2.scale.set(wk2, 1, wk2 * 1.5);
    this.wake2.visible = cfg.bs > 5;

    // ─── FORCE ARROWS ───
    const windScale = 0.8;
    const fScale = 0.006;
    const hdg = cfg.hdg;

    this.twArrow.update(phys.vTW, windScale, 2);
    this.awArrow.update(unRotate(phys.vAW, hdg), windScale, 1.5);

    this.driveArrow.updateScalar(
      new Vector3(0, 0, phys.driveN > 0 ? 1 : -1), Math.abs(phys.driveN), fScale, 1);
    this.heelArrow.updateScalar(
      new Vector3(phys.heelN > 0 ? 1 : -1, 0, 0), Math.abs(phys.heelN), fScale, 1);
    this.hullDragArrow.updateScalar(
      new Vector3(0, 0, -1), phys.hullDragN, fScale, 0.8);

    if (this.sailGrp.visible) {
      const sAng = hdg + cfg.sang;
      this.sLiftArrow.update(unRotate(phys.sail.vL, sAng), fScale);
      this.sDragArrow.update(unRotate(phys.sail.vD, sAng), fScale);
    }
    if (this.rotorGrp.visible) {
      this.rLiftArrow.update(unRotate(phys.rotor.vL, hdg), fScale);
      this.rDragArrow.update(unRotate(phys.rotor.vD, hdg), fScale);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

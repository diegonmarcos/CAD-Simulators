import type { Config, PropulsionMode, PolarPoint } from './types/index';
import { computePhysics } from './physics/engine';
import { computeMetrics } from './physics/metrics';
import { generatePolar, findOptimalVMG } from './physics/polar';
import { TimeSeriesBuffer } from './data/timeseries';
import { SliderDataSource } from './data/api-adapter';
import type { DataSource } from './data/api-adapter';
import { Canvas2DRenderer } from './renderer/canvas2d';
import { Scene3DRenderer } from './renderer/scene3d';
import { BGShader } from './renderer/bg-shader';
import { initControls, initViewToggle } from './ui/controls';
import { initHUD, updateHUD } from './ui/hud';
import { BOAT_DEFAULTS } from './data/defaults.js';

const cfg: Config = { ...BOAT_DEFAULTS } as Config;

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

const canvas2d = getEl<HTMLCanvasElement>('canvas-2d');
const container2d = getEl<HTMLDivElement>('canvas-2d-container');
const container3d = getEl<HTMLDivElement>('container-3d');

let bgShader: BGShader | null = null;
try {
  bgShader = new BGShader(container2d);
} catch (e) {
  console.warn('WebGL background shader failed, using fallback:', e);
}

const renderer2d = new Canvas2DRenderer(canvas2d, container2d);
const renderer3d = new Scene3DRenderer(container3d);

const dataSource: DataSource = new SliderDataSource(cfg);

// Time-series buffers (60 second window)
const tsBoatSpeed = new TimeSeriesBuffer(60);
const tsVMG = new TimeSeriesBuffer(60);
const tsHeel = new TimeSeriesBuffer(60);
const tsAWS = new TimeSeriesBuffer(60);

let polar: PolarPoint[] = [];
let optimalVMG = { upwind: 45, downwind: 135 };

try {
  polar = generatePolar(cfg);
  optimalVMG = findOptimalVMG(cfg);
} catch (e) {
  console.warn('Polar generation failed, using defaults:', e);
}

try {
  initHUD(tsAWS, tsVMG, tsHeel);
} catch (e) {
  console.warn('HUD init failed:', e);
}

const setMode = initControls(cfg, () => {
  polar = generatePolar(cfg);
  optimalVMG = findOptimalVMG(cfg);
  renderer3d.setMode(cfg.mode);
});

// Initialize view toggle (2D/3D)
try {
  initViewToggle();
} catch (e) {
  console.warn('View toggle init failed:', e);
}

setMode('sail');
renderer3d.setMode('sail');

let lastT = 0;
let lastAPICheck = 0;
const API_CHECK_INTERVAL = 2000;

async function updateFromAPI(): Promise<void> {
  const windData = await dataSource.getWind();
  if (windData) {
    cfg.tws = windData.tws;
    cfg.twd = windData.twd;
  }

  const gpsData = await dataSource.getGPS();
  if (gpsData) {
    cfg.hdg = gpsData.heading;
    cfg.bs = gpsData.speed * 1.944;
  }
}

function run(t: number): void {
  requestAnimationFrame(run);

  const dt = (t - lastT) / 1000;
  lastT = t;

  if (t - lastAPICheck > API_CHECK_INTERVAL) {
    lastAPICheck = t;
    updateFromAPI().catch(() => {});
  }

  try {
    const phys = computePhysics(cfg);
    const metrics = computeMetrics(cfg, phys, polar);

    const timeSeconds = t / 1000;
    tsBoatSpeed.push(timeSeconds, cfg.bs);
    tsVMG.push(timeSeconds, metrics.vmg);
    tsHeel.push(timeSeconds, metrics.heelAngle);
    tsAWS.push(timeSeconds, phys.aws);

    renderer2d.render(cfg, phys, polar, optimalVMG);
    renderer3d.update(cfg, phys, dt);
    updateHUD(phys, metrics, cfg.bs, tsAWS, tsHeel);
  } catch (e) {
    console.error('Render error:', e);
  }
}

requestAnimationFrame(run);

import type { Config, PolarPoint } from '../types/index';
import { computePhysics } from './engine';
import { KTS_TO_MS } from './constants';

/**
 * Generate polar diagram data by sweeping through all TWA angles
 * at the current wind speed
 */
export function generatePolar(cfg: Config): PolarPoint[] {
  const polar: PolarPoint[] = [];
  const originalHdg = cfg.hdg;
  const originalTwd = cfg.twd;

  // Sweep TWA from 0 to 180 degrees (both tacks are symmetric)
  for (let twa = 0; twa <= 180; twa += 5) {
    // Set heading to create the desired TWA
    const testCfg = { ...cfg };
    testCfg.hdg = (originalTwd - twa + 360) % 360;

    const phys = computePhysics(testCfg);

    // Record if there's positive drive force
    if (phys.driveN > 0) {
      polar.push({
        twa,
        speed: cfg.bs,
      });
    }
  }

  return polar;
}

/**
 * Find optimal VMG angles (upwind and downwind)
 * Returns { upwind: twa, downwind: twa }
 */
export function findOptimalVMG(cfg: Config): { upwind: number; downwind: number } {
  let maxUpwindVMG = -Infinity;
  let maxDownwindVMG = -Infinity;
  let upwindAngle = 45;
  let downwindAngle = 135;

  const originalHdg = cfg.hdg;
  const originalTwd = cfg.twd;

  for (let twa = 20; twa <= 180; twa += 5) {
    const testCfg = { ...cfg };
    testCfg.hdg = (originalTwd - twa + 360) % 360;

    const phys = computePhysics(testCfg);
    const bs = cfg.bs * KTS_TO_MS;
    const vmg = bs * Math.cos((twa * Math.PI) / 180);

    if (twa < 90 && vmg > maxUpwindVMG) {
      maxUpwindVMG = vmg;
      upwindAngle = twa;
    } else if (twa >= 90 && vmg > maxDownwindVMG) {
      maxDownwindVMG = vmg;
      downwindAngle = twa;
    }
  }

  return { upwind: upwindAngle, downwind: downwindAngle };
}

/**
 * Get theoretical max speed at current TWA from polar data
 */
export function getTargetSpeed(polar: PolarPoint[], twa: number): number {
  if (polar.length === 0) return 0;

  const absTWA = Math.abs(twa);
  let closest = polar[0];
  let minDiff = Math.abs(polar[0].twa - absTWA);

  for (const p of polar) {
    const diff = Math.abs(p.twa - absTWA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }

  return closest.speed;
}

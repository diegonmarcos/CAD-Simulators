import type { Config, PhysicsState, DerivedMetrics, PolarPoint } from '../types/index';
import { KTS_TO_MS, KEEL_AREA, RHO_WATER, GRAVITY, RIGHTING_ARM_COEF } from './constants';
import { getTargetSpeed } from './polar';

/**
 * Compute derived sailing metrics from physics state
 */
export function computeMetrics(
  cfg: Config,
  phys: PhysicsState,
  polar: PolarPoint[]
): DerivedMetrics {
  const bs = cfg.bs * KTS_TO_MS;

  // VMG = boat speed * cos(TWA)
  const vmg = bs * Math.cos((phys.twa * Math.PI) / 180);

  // Polar efficiency = actual speed / target speed from polar
  const targetSpeed = getTargetSpeed(polar, phys.twa);
  const polarEfficiency = targetSpeed > 0 ? (bs / targetSpeed) * 100 : 0;

  // Leeway angle = arctan(lateral force / (rho * v^2 * keel_area))
  // Simplified model based on side force vs. hydrodynamic resistance
  const dynamicPressure = 0.5 * RHO_WATER * bs * bs;
  const lateralResistance = dynamicPressure * KEEL_AREA;
  const leewayAngle =
    lateralResistance > 0
      ? Math.atan(phys.heelN / (lateralResistance + 0.1)) * (180 / Math.PI)
      : 0;

  // Heel angle = arcsin(heeling moment / (mass * g * righting arm))
  // Simplified: assume heeling moment ~= heelN * mast_height (10m approximation)
  const mastHeight = 10; // m
  const heelingMoment = phys.heelN * mastHeight;
  const rightingMoment = cfg.mass * GRAVITY * RIGHTING_ARM_COEF;
  const heelAngle =
    rightingMoment > 0
      ? Math.asin(Math.min(1, heelingMoment / rightingMoment)) * (180 / Math.PI)
      : 0;

  // Course over ground = heading + leeway (simplified, ignores current)
  let cog = cfg.hdg + (phys.heelN > 0 ? leewayAngle : -leewayAngle);
  cog = ((cog % 360) + 360) % 360;

  // Optimal trim suggestion
  let optimalTrimSuggestion = 'Trim OK';
  if (cfg.mode === 'sail') {
    const absAWA = Math.abs(phys.awa);
    if (absAWA < 30 && Math.abs(cfg.sang) > 15) {
      optimalTrimSuggestion = 'Sheet in (tight reach)';
    } else if (absAWA > 120 && Math.abs(cfg.sang) < 70) {
      optimalTrimSuggestion = 'Ease sheets (broad reach)';
    } else if (phys.stalled) {
      optimalTrimSuggestion = 'Stalled! Ease sheets';
    }
  }

  return {
    vmg,
    polarEfficiency: Math.min(100, polarEfficiency),
    leewayAngle,
    heelAngle,
    cog,
    rightingMoment,
    optimalTrimSuggestion,
    stallWarning: phys.stalled,
  };
}

/**
 * Normalize angle to -180 to +180
 */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

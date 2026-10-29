import type { PolarPoint } from '../types/index';
import * as V from '../physics/vec';

/**
 * Draw polar diagram overlay on compass rose
 * Shows optimal boat speeds at various TWA angles
 */
export function drawPolarOverlay(
  ctx: CanvasRenderingContext2D,
  polar: PolarPoint[],
  currentTWA: number,
  scale: number,
  radiusBase: number
): void {
  if (polar.length === 0) return;

  // Find max speed for scaling
  let maxSpeed = 0;
  for (const p of polar) {
    if (p.speed > maxSpeed) maxSpeed = p.speed;
  }

  if (maxSpeed === 0) return;

  const maxRadius = radiusBase * 0.85;

  // Draw polar curve
  ctx.save();
  ctx.strokeStyle = '#22d3ee80'; // Semi-transparent cyan
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#22d3ee';
  ctx.beginPath();

  for (let i = 0; i < polar.length; i++) {
    const p = polar[i];
    const r = (p.speed / maxSpeed) * maxRadius;
    const vec = V.fromAngle(p.twa, r);

    if (i === 0) {
      ctx.moveTo(vec.x, vec.y);
    } else {
      ctx.lineTo(vec.x, vec.y);
    }
  }

  // Mirror for port tack
  for (let i = polar.length - 1; i >= 0; i--) {
    const p = polar[i];
    const r = (p.speed / maxSpeed) * maxRadius;
    const vec = V.fromAngle(-p.twa, r);
    ctx.lineTo(vec.x, vec.y);
  }

  ctx.closePath();
  ctx.stroke();

  // Fill with gradient
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
  gradient.addColorStop(0, '#22d3ee20');
  gradient.addColorStop(1, '#22d3ee05');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.restore();

  // Mark current TWA on polar (only if currentTWA is valid)
  if (currentTWA !== undefined && currentTWA !== null) {
    const currentPoint = findClosestPolarPoint(polar, Math.abs(currentTWA));
    if (currentPoint) {
    const r = (currentPoint.speed / maxSpeed) * maxRadius;
    const vec = V.fromAngle(currentTWA, r);

    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fde047';
      ctx.beginPath();
      ctx.arc(vec.x, vec.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * Draw VMG indicator showing optimal upwind/downwind angles
 */
export function drawVMGIndicator(
  ctx: CanvasRenderingContext2D,
  optimalUpwind: number,
  optimalDownwind: number,
  radius: number
): void {
  ctx.save();
  ctx.strokeStyle = '#22c55e60';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  // Upwind angles (both tacks)
  const upwindR = V.fromAngle(optimalUpwind, radius);
  const upwindL = V.fromAngle(-optimalUpwind, radius);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(upwindR.x, upwindR.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(upwindL.x, upwindL.y);
  ctx.stroke();

  // Downwind angles (both tacks)
  const downwindR = V.fromAngle(optimalDownwind, radius);
  const downwindL = V.fromAngle(-optimalDownwind, radius);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(downwindR.x, downwindR.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(downwindL.x, downwindL.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Find closest polar point for a given TWA
 */
function findClosestPolarPoint(polar: PolarPoint[], twa: number): PolarPoint | null {
  if (polar.length === 0) return null;

  let closest = polar[0];
  let minDiff = Math.abs(polar[0].twa - twa);

  for (const p of polar) {
    const diff = Math.abs(p.twa - twa);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }

  return closest;
}

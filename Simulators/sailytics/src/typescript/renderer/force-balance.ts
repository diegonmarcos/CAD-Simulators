import type { PhysicsState } from '../types/index';

/**
 * Draw force balance stacked bar showing drive forces vs drag forces
 */
export function drawForceBalance(
  ctx: CanvasRenderingContext2D,
  phys: PhysicsState,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const maxForce = Math.max(
    phys.driveN,
    phys.hullDragN + phys.waveDragN,
    1000
  );

  // Background
  ctx.fillStyle = '#0f172a80';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Title
  ctx.save();
  ctx.scale(1, -1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px Inter';
  ctx.fillText('Force Balance', x + 5, -(y + height - 15));
  ctx.restore();

  const barY = y + 30;
  const barHeight = height - 40;
  const barSpacing = 10;
  const barWidth = (width - barSpacing * 3) / 2;

  // Drive forces bar (left)
  const driveX = x + barSpacing;
  let driveStackY = barY;

  // Sail lift component
  const sailDrive = Math.max(0, phys.sail.drive);
  const sailHeight = (sailDrive / maxForce) * barHeight;
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(driveX, driveStackY, barWidth, sailHeight);
  driveStackY += sailHeight;

  // Rotor lift component
  const rotorDrive = Math.max(0, phys.rotor.drive);
  const rotorHeight = (rotorDrive / maxForce) * barHeight;
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(driveX, driveStackY, barWidth, rotorHeight);

  // Drive label
  ctx.save();
  ctx.scale(1, -1);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '9px Inter';
  ctx.fillText('Drive', driveX + 5, -(barY - 8));
  ctx.fillText(`${Math.round(phys.driveN)} N`, driveX + 5, -(barY - 18));
  ctx.restore();

  // Drag forces bar (right)
  const dragX = x + width - barSpacing - barWidth;
  let dragStackY = barY;

  // Hull drag
  const hullHeight = (phys.hullDragN / maxForce) * barHeight;
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(dragX, dragStackY, barWidth, hullHeight);
  dragStackY += hullHeight;

  // Wave drag
  const waveHeight = (phys.waveDragN / maxForce) * barHeight;
  ctx.fillStyle = '#818cf8';
  ctx.fillRect(dragX, dragStackY, barWidth, waveHeight);
  dragStackY += waveHeight;

  // Aero drag (sail + rotor)
  const aeroDrag = Math.abs(phys.sail.D) + Math.abs(phys.rotor.D);
  const aeroHeight = (aeroDrag / maxForce) * barHeight;
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(dragX, dragStackY, barWidth, aeroHeight);

  // Drag label
  ctx.save();
  ctx.scale(1, -1);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '9px Inter';
  ctx.fillText('Drag', dragX + 5, -(barY - 8));
  const totalDrag = phys.hullDragN + phys.waveDragN + aeroDrag;
  ctx.fillText(`${Math.round(totalDrag)} N`, dragX + 5, -(barY - 18));
  ctx.restore();

  // Center line (zero reference)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x + barSpacing, barY);
  ctx.lineTo(x + width - barSpacing, barY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Legend
  ctx.save();
  ctx.scale(1, -1);
  const legendY = -(y + 5);
  const swatchSize = 8;

  // Sail drive
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(driveX, legendY, swatchSize, swatchSize);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '8px Inter';
  ctx.fillText('Sail', driveX + swatchSize + 3, legendY + 7);

  // Rotor drive
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(driveX + 40, legendY, swatchSize, swatchSize);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Rotor', driveX + 40 + swatchSize + 3, legendY + 7);

  // Hull drag
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(dragX, legendY, swatchSize, swatchSize);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Hull', dragX + swatchSize + 3, legendY + 7);

  // Wave drag
  ctx.fillStyle = '#818cf8';
  ctx.fillRect(dragX + 35, legendY, swatchSize, swatchSize);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Wave', dragX + 35 + swatchSize + 3, legendY + 7);

  ctx.restore();
}

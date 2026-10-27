import type { Config, PhysicsState, Vec2D, PolarPoint } from '../types/index';
import * as V from '../physics/vec';
import { drawPolarOverlay, drawVMGIndicator } from './polar-overlay';
import { drawForceBalance } from './force-balance';

interface ArrowOpts {
  label?: string;
  dashed?: boolean;
  glow?: boolean;
  widthScale?: number;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;

    let resizeTimeout: number;
    this.observer = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => this.resize(container), 0);
    });
    this.observer.observe(container);
    this.resize(container);
  }

  private resize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width > 0 && height > 0 && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GRADIENT-FILLED POLYGON FORCE ARROW
  // ═══════════════════════════════════════════════════════════════
  private drawForceArrow(
    ox: number, oy: number,
    vx: number, vy: number,
    color: string,
    opts: ArrowOpts = {}
  ): void {
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag < 2) return;

    const ctx = this.ctx;
    const angle = Math.atan2(vy, vx);
    const headLen = Math.min(mag * 0.20, 18);
    const shaftLen = Math.max(mag - headLen, 1);
    const ws = opts.widthScale || 1;
    const shaftW = Math.min(Math.max(mag * 0.045, 2.2), 5.5) * ws;
    const headW = shaftW * 3.0;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);

    // Glow halo
    if (opts.glow) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
    }

    // Gradient along shaft length
    const grad = ctx.createLinearGradient(0, 0, mag, 0);
    grad.addColorStop(0, color + '10');
    grad.addColorStop(0.25, color + '70');
    grad.addColorStop(0.6, color + 'b0');
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.beginPath();
    // Tapered shaft → flared head → sharp tip
    ctx.moveTo(0, -shaftW * 0.25);
    ctx.lineTo(shaftLen, -shaftW * 0.5);
    ctx.lineTo(shaftLen, -headW * 0.5);
    ctx.lineTo(mag, 0);
    ctx.lineTo(shaftLen, headW * 0.5);
    ctx.lineTo(shaftLen, shaftW * 0.5);
    ctx.lineTo(0, shaftW * 0.25);
    ctx.closePath();
    ctx.fill();

    // Top edge highlight
    ctx.strokeStyle = color + '30';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(4, -shaftW * 0.25);
    ctx.lineTo(shaftLen, -shaftW * 0.5);
    ctx.lineTo(shaftLen, -headW * 0.5);
    ctx.lineTo(mag, 0);
    ctx.stroke();

    // Dashed centerline for decomposition arrows
    if (opts.dashed) {
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 0.7;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(shaftLen - 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Label at tip
    if (opts.label) {
      ctx.save();
      ctx.scale(1, -1);
      ctx.font = 'bold 9px Inter';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.92;
      const tipX = ox + vx;
      const tipY = oy + vy;
      const oX = Math.cos(angle) * 18;
      const oY = Math.sin(angle) * 18;
      ctx.fillText(opts.label, tipX + oX - 8, -(tipY + oY) + 3);
      ctx.restore();
    }
  }

  private rotateVec(v: Vec2D, angleDeg: number): Vec2D {
    const r = angleDeg * (Math.PI / 180);
    return {
      x: v.x * Math.cos(r) - v.y * Math.sin(r),
      y: v.x * Math.sin(r) + v.y * Math.cos(r),
    };
  }

  private drawOriginDot(x: number, y: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 6);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color + '60');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 8-POINT COMPASS ROSE
  // ═══════════════════════════════════════════════════════════════
  private drawCompassRose(radius: number): void {
    const ctx = this.ctx;

    // Outer double ring
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#1a5a8a18';
    ctx.strokeStyle = '#1e4468';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#142e48';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.965, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Inner gradient
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.96);
    bg.addColorStop(0, '#0c1e3006');
    bg.addColorStop(0.6, '#0c1e3012');
    bg.addColorStop(1, '#0c1e3035');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
    ctx.fill();

    // Degree ticks
    for (let deg = 0; deg < 360; deg += 5) {
      const isCard = deg % 90 === 0;
      const isMaj = deg % 30 === 0;
      const is10 = deg % 10 === 0;
      const r = deg * Math.PI / 180;
      const inner = radius * (isCard ? 0.83 : isMaj ? 0.88 : is10 ? 0.92 : 0.95);
      const outer = radius * 0.975;
      ctx.strokeStyle = isCard ? '#4a8abe' : isMaj ? '#2a5a7e' : is10 ? '#1a3a5c70' : '#1a3a5c28';
      ctx.lineWidth = isCard ? 2 : isMaj ? 1.2 : 0.5;
      ctx.beginPath();
      ctx.moveTo(inner * Math.sin(r), inner * Math.cos(r));
      ctx.lineTo(outer * Math.sin(r), outer * Math.cos(r));
      ctx.stroke();
    }

    // 8-point star
    this.drawStarPoints(radius * 0.78);

    // Labels
    ctx.save();
    ctx.scale(1, -1);
    const lr = radius + 14;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // N — cyan glow
    ctx.font = 'bold 13px Inter';
    ctx.fillStyle = '#7ec8ee';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#7ec8ee40';
    ctx.fillText('N', 0, -lr);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 11px Inter';
    ctx.fillStyle = '#4a7a9e';
    ctx.fillText('E', lr, 0);
    ctx.fillText('S', 0, lr);
    ctx.fillText('W', -lr, 0);

    // Intercardinals
    ctx.font = '8px Inter';
    ctx.fillStyle = '#2a5a7e70';
    const d = Math.sin(Math.PI / 4) * (radius + 10);
    ctx.fillText('NE', d, -d);
    ctx.fillText('SE', d, d);
    ctx.fillText('SW', -d, d);
    ctx.fillText('NW', -d, -d);

    // Degree numbers
    ctx.font = '7px JetBrains Mono';
    ctx.fillStyle = '#2a5a7e50';
    for (let deg = 30; deg < 360; deg += 30) {
      if (deg % 90 === 0) continue;
      const r = deg * Math.PI / 180;
      const nr = radius * 0.81;
      ctx.fillText(`${deg}`, nr * Math.sin(r) - 5, -(nr * Math.cos(r)) + 3);
    }
    ctx.restore();
  }

  private drawStarPoints(radius: number): void {
    const ctx = this.ctx;
    const midR = radius * 0.42;

    ctx.save();

    // 4 Cardinal points (long)
    for (let i = 0; i < 4; i++) {
      const a = (i * 90) * Math.PI / 180;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const tipR = radius;
      const sp = radius * 0.055;

      const grad = ctx.createLinearGradient(0, 0, tipR * s, tipR * c);
      if (i === 0) {
        grad.addColorStop(0, '#1a3a5c');
        grad.addColorStop(1, '#5aaade');
      } else {
        grad.addColorStop(0, '#1a3a5c');
        grad.addColorStop(1, '#2a5a7e');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tipR * s, tipR * c);
      ctx.lineTo(midR * s + sp * c, midR * c - sp * s);
      ctx.lineTo(0, 0);
      ctx.lineTo(midR * s - sp * c, midR * c + sp * s);
      ctx.closePath();
      ctx.fill();

      // Edge highlight
      ctx.strokeStyle = i === 0 ? '#5aaade30' : '#2a5a7e20';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(midR * s + sp * c, midR * c - sp * s);
      ctx.lineTo(tipR * s, tipR * c);
      ctx.stroke();
    }

    // 4 Intercardinal points (shorter)
    for (let i = 0; i < 4; i++) {
      const a = (i * 90 + 45) * Math.PI / 180;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const tipR = radius * 0.52;
      const iR = radius * 0.1;
      const sp = radius * 0.032;

      ctx.fillStyle = '#1a3a5c50';
      ctx.beginPath();
      ctx.moveTo(tipR * s, tipR * c);
      ctx.lineTo(iR * s + sp * c, iR * c - sp * s);
      ctx.lineTo(0, 0);
      ctx.lineTo(iR * s - sp * c, iR * c + sp * s);
      ctx.closePath();
      ctx.fill();
    }

    // Center jewel
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
    cg.addColorStop(0, '#6abaee');
    cg.addColorStop(0.4, '#3a7aae');
    cg.addColorStop(1, '#1a3a5c');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // DETAILED BOAT (top-down)
  // ═══════════════════════════════════════════════════════════════
  private drawBoat(boatLen: number, scale: number): void {
    const ctx = this.ctx;
    const bw = 7.5 * scale;

    // Hull — cross-light gradient
    const hg = ctx.createLinearGradient(-bw, 0, bw, 0);
    hg.addColorStop(0, '#8494a7');
    hg.addColorStop(0.2, '#c8d5e2');
    hg.addColorStop(0.4, '#f1f5f9');
    hg.addColorStop(0.5, '#ffffff');
    hg.addColorStop(0.6, '#f1f5f9');
    hg.addColorStop(0.8, '#c8d5e2');
    hg.addColorStop(1, '#8494a7');

    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, boatLen * 0.52);
    ctx.bezierCurveTo(2.5 * scale, boatLen * 0.46, bw * 0.7, boatLen * 0.28, bw, boatLen * 0.08);
    ctx.bezierCurveTo(bw * 1.02, -boatLen * 0.06, bw, -boatLen * 0.22, bw * 0.93, -boatLen * 0.36);
    ctx.bezierCurveTo(bw * 0.82, -boatLen * 0.44, bw * 0.55, -boatLen * 0.49, bw * 0.48, -boatLen * 0.50);
    ctx.lineTo(-bw * 0.48, -boatLen * 0.50);
    ctx.bezierCurveTo(-bw * 0.55, -boatLen * 0.49, -bw * 0.82, -boatLen * 0.44, -bw * 0.93, -boatLen * 0.36);
    ctx.bezierCurveTo(-bw, -boatLen * 0.22, -bw * 1.02, -boatLen * 0.06, -bw, boatLen * 0.08);
    ctx.bezierCurveTo(-bw * 0.7, boatLen * 0.28, -2.5 * scale, boatLen * 0.46, 0, boatLen * 0.52);
    ctx.closePath();
    ctx.fill();

    // Hull stroke
    ctx.strokeStyle = '#5a7a94';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Waterline highlight (starboard)
    ctx.strokeStyle = '#3b82f618';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, boatLen * 0.50);
    ctx.bezierCurveTo(2 * scale, boatLen * 0.44, bw * 0.65, boatLen * 0.26, bw * 0.94, boatLen * 0.07);
    ctx.bezierCurveTo(bw * 0.96, -boatLen * 0.05, bw * 0.94, -boatLen * 0.20, bw * 0.88, -boatLen * 0.34);
    ctx.stroke();

    // Deck (inset fill)
    const di = 0.82;
    ctx.fillStyle = '#e8ecf108';
    ctx.beginPath();
    ctx.moveTo(0, boatLen * 0.46);
    ctx.bezierCurveTo(2 * scale, boatLen * 0.40, bw * di * 0.7, boatLen * 0.24, bw * di, boatLen * 0.06);
    ctx.bezierCurveTo(bw * di, -boatLen * 0.08, bw * di * 0.98, -boatLen * 0.20, bw * di * 0.9, -boatLen * 0.32);
    ctx.lineTo(bw * di * 0.45, -boatLen * 0.45);
    ctx.lineTo(-bw * di * 0.45, -boatLen * 0.45);
    ctx.lineTo(-bw * di * 0.9, -boatLen * 0.32);
    ctx.bezierCurveTo(-bw * di * 0.98, -boatLen * 0.20, -bw * di, -boatLen * 0.08, -bw * di, boatLen * 0.06);
    ctx.bezierCurveTo(-bw * di * 0.7, boatLen * 0.24, -2 * scale, boatLen * 0.40, 0, boatLen * 0.46);
    ctx.closePath();
    ctx.fill();

    // Cabin
    ctx.fillStyle = '#94a3b825';
    ctx.strokeStyle = '#64748b35';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(-bw * 0.38, -boatLen * 0.12, bw * 0.76, boatLen * 0.28, 3 * scale);
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#47556910';
    ctx.strokeStyle = '#47556928';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.roundRect(-bw * 0.5, -boatLen * 0.40, bw * 1.0, boatLen * 0.20, 2 * scale);
    ctx.fill();
    ctx.stroke();

    // Centerline
    ctx.strokeStyle = '#47556916';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, boatLen * 0.42);
    ctx.lineTo(0, -boatLen * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);

    // Mast base (glowing dot)
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#47556960';
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(0, boatLen * 0.04, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shrouds
    ctx.strokeStyle = '#47556916';
    ctx.lineWidth = 0.5;
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(0, boatLen * 0.04);
      ctx.lineTo(bw * 0.85 * side, boatLen * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, boatLen * 0.04);
      ctx.lineTo(bw * 0.7 * side, -boatLen * 0.05);
      ctx.stroke();
    }

    // Winches
    ctx.fillStyle = '#47556928';
    for (const [wx, wy] of [
      [bw * 0.52, -boatLen * 0.14],
      [-bw * 0.52, -boatLen * 0.14],
      [bw * 0.55, -boatLen * 0.26],
      [-bw * 0.55, -boatLen * 0.26],
    ]) {
      ctx.beginPath();
      ctx.arc(wx, wy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bow pulpit
    ctx.strokeStyle = '#64748b45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.4, boatLen * 0.28);
    ctx.lineTo(0, boatLen * 0.49);
    ctx.lineTo(bw * 0.4, boatLen * 0.28);
    ctx.stroke();

    // Keel
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -boatLen * 0.04);
    ctx.lineTo(0, -boatLen * 0.40);
    ctx.stroke();

    // Rudder
    ctx.fillStyle = '#47556938';
    ctx.beginPath();
    ctx.moveTo(-1.8 * scale, -boatLen * 0.50);
    ctx.lineTo(0, -boatLen * 0.57);
    ctx.lineTo(1.8 * scale, -boatLen * 0.50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  render(
    cfg: Config,
    phys: PhysicsState,
    polar: PolarPoint[] = [],
    optimalVMG = { upwind: 45, downwind: 135 }
  ): void {
    this.time = performance.now() / 1000;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = Math.min(w, h) / 100;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, -1);

    // ═══ COMPASS ROSE ═══
    const crRadius = 42 * scale;
    this.drawCompassRose(crRadius);

    // ─── Magnetic North indicator ───
    const declRad = cfg.decl * (Math.PI / 180);
    const magOuter = crRadius * 1.02;
    const magInner = crRadius * 0.82;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(magInner * Math.sin(declRad), magInner * Math.cos(declRad));
    ctx.lineTo(magOuter * Math.sin(declRad), magOuter * Math.cos(declRad));
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    const mtX = magOuter * Math.sin(declRad);
    const mtY = magOuter * Math.cos(declRad);
    ctx.beginPath();
    ctx.arc(mtX, mtY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // "M" label
    ctx.save();
    ctx.scale(1, -1);
    ctx.font = 'bold 8px Inter';
    ctx.fillStyle = '#ef4444';
    ctx.globalAlpha = 0.85;
    const mR = crRadius * 1.1;
    ctx.fillText('M', mR * Math.sin(declRad) - 3, -(mR * Math.cos(declRad)) + 3);
    ctx.restore();

    // Declination arc
    if (Math.abs(cfg.decl) > 0.5) {
      ctx.strokeStyle = '#ef444438';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      const arcR = crRadius * 0.86;
      const sa = Math.PI / 2;
      const ea = Math.PI / 2 - declRad;
      ctx.arc(0, 0, arcR, Math.min(sa, ea), Math.max(sa, ea));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Polar overlay
    if (polar.length > 0 && phys.twa !== undefined) {
      drawPolarOverlay(ctx, polar, phys.twa, scale, crRadius);
      drawVMGIndicator(ctx, optimalVMG.upwind, optimalVMG.downwind, crRadius);
    }

    // ═══ BOAT + FORCE VECTORS ═══
    const boatLen = 24 * scale;
    ctx.save();
    ctx.rotate(-cfg.hdg * (Math.PI / 180));
    this.drawBoat(boatLen, scale);

    // Force origins
    const bowP = { x: 0, y: boatLen * 0.48 };
    const sailP = { x: 0, y: cfg.mode === 'hybrid' ? 4 * scale : 2 * scale };
    const rotorP = { x: 0, y: cfg.mode === 'hybrid' ? -6 * scale : 2 * scale };
    const keelP = { x: 0, y: 0 };

    const maxF = Math.max(Math.abs(phys.driveN), Math.abs(phys.heelN), 500);
    const fScl = (42 * scale) / maxF;
    const awScl = scale * 2.2;

    // Apparent wind
    const awLocal = this.rotateVec(phys.vAW, cfg.hdg);
    this.drawForceArrow(bowP.x, bowP.y, awLocal.x * awScl, awLocal.y * awScl,
      '#22d3ee', { label: 'AW', dashed: true });

    // Sail forces
    if (cfg.mode !== 'rotor') {
      const lL = this.rotateVec(phys.sail.vL, cfg.hdg);
      const dL = this.rotateVec(phys.sail.vD, cfg.hdg);
      this.drawOriginDot(sailP.x, sailP.y, '#f472b6');
      this.drawForceArrow(sailP.x, sailP.y, lL.x * fScl, lL.y * fScl,
        '#f472b6', { label: 'Lift', dashed: true });
      this.drawForceArrow(sailP.x, sailP.y, dL.x * fScl, dL.y * fScl,
        '#fb923c', { label: 'Drag', dashed: true });
    }

    // Rotor forces
    if (cfg.mode !== 'sail') {
      const lL = this.rotateVec(phys.rotor.vL, cfg.hdg);
      const dL = this.rotateVec(phys.rotor.vD, cfg.hdg);
      this.drawOriginDot(rotorP.x, rotorP.y, '#fdba74');
      this.drawForceArrow(rotorP.x, rotorP.y, lL.x * fScl, lL.y * fScl,
        '#f472b6', { label: 'R.Lift', dashed: true });
      this.drawForceArrow(rotorP.x, rotorP.y, dL.x * fScl, dL.y * fScl,
        '#fb923c', { label: 'R.Drag', dashed: true });
    }

    // Hull drag
    const hdL = this.rotateVec(phys.vHullDrag, cfg.hdg);
    this.drawOriginDot(keelP.x, keelP.y, '#6366f1');
    this.drawForceArrow(keelP.x, keelP.y, hdL.x * fScl, hdL.y * fScl,
      '#6366f1', { label: 'Hull', glow: true, widthScale: 1.3 });

    ctx.restore();

    // ─── GLOBAL VECTORS ───
    this.drawForceArrow(0, 0, phys.vTW.x * awScl, phys.vTW.y * awScl,
      '#3b82f6', { label: 'TW', dashed: true });

    this.drawForceArrow(0, 0, phys.vTotDrive.x * fScl, phys.vTotDrive.y * fScl,
      '#22c55e', { label: 'Drive', glow: true, widthScale: 1.5 });

    // Drive magnitude
    const driveMag = Math.round(Math.abs(phys.driveN));
    if (driveMag > 10) {
      const dTipX = phys.vTotDrive.x * fScl;
      const dTipY = phys.vTotDrive.y * fScl;
      ctx.save();
      ctx.scale(1, -1);
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#22c55e';
      ctx.globalAlpha = 0.85;
      ctx.fillText(`${driveMag} N`, dTipX + 14, -dTipY - 6);
      ctx.restore();
    }

    this.drawForceArrow(0, 0, phys.vTotHeel.x * fScl, phys.vTotHeel.y * fScl,
      '#ef4444', { label: 'Heel', glow: true, widthScale: 1.5 });

    const heelMag = Math.round(Math.abs(phys.heelN));
    if (heelMag > 10) {
      const hTipX = phys.vTotHeel.x * fScl;
      const hTipY = phys.vTotHeel.y * fScl;
      ctx.save();
      ctx.scale(1, -1);
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#ef4444';
      ctx.globalAlpha = 0.85;
      ctx.fillText(`${heelMag} N`, hTipX + 14, -hTipY - 6);
      ctx.restore();
    }

    ctx.restore();

    // ═══ FORCE BALANCE ═══
    const fbW = 160;
    const fbH = 130;
    drawForceBalance(ctx, phys, w - fbW - 12, 12, fbW, fbH);

    // ═══ MULTI-VIEW INSETS ═══
    this.drawSideView(cfg, phys, w, h);
    this.drawFrontView(cfg, phys, w, h);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIDE VIEW — Profile with undersea terrain, light shafts, fish
  // ═══════════════════════════════════════════════════════════════
  private drawSideView(cfg: Config, phys: PhysicsState, w: number, h: number): void {
    const ctx = this.ctx;
    const t = this.time;
    const vw = 340;
    const vh = 220;
    const vx = w - vw - 12;
    const vy = h - vh - 12;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 8);
    ctx.clip();

    // Sky → ocean depth gradient
    const bg = ctx.createLinearGradient(vx, vy, vx, vy + vh);
    bg.addColorStop(0, '#0c1628');
    bg.addColorStop(0.28, '#0a2040');
    bg.addColorStop(0.31, '#062a50');
    bg.addColorStop(0.60, '#04203e');
    bg.addColorStop(1, '#021428');
    ctx.fillStyle = bg;
    ctx.fillRect(vx, vy, vw, vh);

    // Title
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(vx, vy, vw, 18);
    ctx.font = 'bold 8px Inter';
    ctx.fillStyle = '#3a6a8e';
    ctx.fillText('SIDE PROFILE', vx + 8, vy + 12);

    if (cfg.bs > 1) {
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.fillStyle = '#06d6a0';
      ctx.textAlign = 'right';
      ctx.fillText(`${cfg.bs.toFixed(1)} kts`, vx + vw - 8, vy + 12);
      ctx.textAlign = 'left';
    }

    const cx = vx + vw * 0.45;
    const waterY = vy + vh * 0.32;
    const s = 1.8;

    // Stars
    ctx.fillStyle = '#7eb8dc18';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(vx + 20 + ((i * 41) % (vw - 40)), vy + 22 + ((i * 7) % 20), 1, 1);
    }

    // Waterline with subtle wave animation
    ctx.strokeStyle = '#06d6a060';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vx, waterY);
    for (let wx = vx; wx <= vx + vw; wx += 2) {
      const waveOff = Math.sin((wx - vx) * 0.06 + t * 1.5) * 1.2;
      ctx.lineTo(wx, waterY + waveOff);
    }
    ctx.stroke();

    // Wave surface ripples
    ctx.strokeStyle = '#06d6a020';
    ctx.lineWidth = 0.6;
    for (let wx = vx + 6; wx < vx + vw - 6; wx += 16) {
      ctx.beginPath();
      ctx.moveTo(wx, waterY + 2);
      ctx.quadraticCurveTo(wx + 4, waterY - 1, wx + 8, waterY + 2);
      ctx.stroke();
    }

    // Underwater depth gradient
    const og = ctx.createLinearGradient(vx, waterY, vx, vy + vh);
    og.addColorStop(0, 'rgba(6, 42, 80, 0.12)');
    og.addColorStop(0.3, 'rgba(4, 32, 60, 0.22)');
    og.addColorStop(0.6, 'rgba(3, 22, 45, 0.38)');
    og.addColorStop(1, 'rgba(2, 14, 30, 0.55)');
    ctx.fillStyle = og;
    ctx.fillRect(vx, waterY + 2, vw, vy + vh - waterY - 2);

    // Light shafts from surface
    ctx.save();
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 5; i++) {
      const shX = vx + 35 + i * 68;
      const topW = 6;
      const botW = 30 + Math.sin(t * 0.7 + i) * 6;
      const drift = Math.sin(t * 0.3 + i * 1.5) * 4;
      const sg = ctx.createLinearGradient(shX, waterY, shX + drift, vy + vh);
      sg.addColorStop(0, '#38bdf8');
      sg.addColorStop(1, '#38bdf800');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(shX - topW / 2, waterY);
      ctx.lineTo(shX + topW / 2, waterY);
      ctx.lineTo(shX + drift + botW / 2, vy + vh);
      ctx.lineTo(shX + drift - botW / 2, vy + vh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Bioluminescent particles (animated)
    for (let i = 0; i < 18; i++) {
      const px = vx + 15 + ((i * 19 + 7 + Math.sin(t * 0.5 + i) * 5) % (vw - 30));
      const py = waterY + 18 + ((i * 13 + 3) % (vh * 0.55));
      const sz = 1 + (i % 3) * 0.4;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i * 0.7));
      ctx.fillStyle = i % 4 === 0 ? `rgba(6, 214, 160, ${0.12 * pulse})` : `rgba(56, 189, 248, ${0.10 * pulse})`;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    // Undersea terrain
    const terrainBase = vy + vh;

    // Main terrain mass
    ctx.fillStyle = '#0e2a40';
    ctx.strokeStyle = '#1a4a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vx, terrainBase);
    for (let tx = 0; tx <= vw; tx += 2) {
      const nx = (tx - vw * 0.45) * 0.025;
      const h1 = Math.sin(nx * 1.3) * 20;
      const h2 = Math.sin(nx * 3.7 + 1.5) * 10;
      const h3 = Math.sin(nx * 7.1 + 0.8) * 5;
      const h4 = Math.sin(nx * 0.5) * 15;
      ctx.lineTo(vx + tx, terrainBase - (35 + h1 + h2 + h3 + h4));
    }
    ctx.lineTo(vx + vw, terrainBase);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ridge highlight
    ctx.strokeStyle = '#1a5a8a35';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let tx = 0; tx <= vw; tx += 2) {
      const nx = (tx - vw * 0.45) * 0.025;
      const th = 25 + Math.sin(nx * 1.3 + 0.5) * 14 + Math.sin(nx * 3.7 + 2.5) * 7 + Math.sin(nx * 0.5 + 1) * 10;
      if (tx === 0) ctx.moveTo(vx + tx, terrainBase - th);
      else ctx.lineTo(vx + tx, terrainBase - th);
    }
    ctx.stroke();

    // Caustic light patterns on seabed (animated)
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 10; i++) {
      const ca = vx + 20 + ((i * 37 + Math.floor(t * 8)) % (vw - 40));
      const cb = terrainBase - 18 - (i % 5) * 6;
      const cs = 3 + Math.sin(t * 1.2 + i * 0.9) * 2;
      ctx.beginPath();
      ctx.arc(ca, cb, cs, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Sediment
    ctx.fillStyle = '#1a3a50';
    ctx.fillRect(vx, terrainBase - 6, vw, 6);

    // Rock formations
    ctx.fillStyle = '#163050';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(vx + 25 + ((i * 67) % (vw - 50)), terrainBase - 12 - (i % 3) * 8, 4 + (i % 3) * 2, 3 + (i % 2) * 2);
    }

    // Kelp/seaweed
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#16654a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const kx = vx + 30 + ((i * 55) % (vw - 60));
      const ky = terrainBase - 20 - (i % 3) * 10;
      const sway = Math.sin(t * 0.8 + i * 1.3) * 3;
      ctx.beginPath();
      ctx.moveTo(kx, ky + 15);
      ctx.quadraticCurveTo(kx + sway, ky + 5, kx + sway * 0.5, ky);
      ctx.stroke();
    }
    ctx.restore();

    // Fish (animated)
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 8; i++) {
      const fxBase = vx + 20 + ((i * 42 + 11) % (vw - 40));
      const fxAnim = Math.sin(t * 0.4 + i * 2.1) * 8;
      const fx = fxBase + fxAnim;
      const fy = waterY + 22 + ((i * 19 + 5) % (vh * 0.32));
      const fSize = 4 + (i % 3) * 2;
      const fDir = i % 2 === 0 ? 1 : -1;

      ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#06d6a0' : '#7eb8dc';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fSize * fDir, fy - fSize * 0.3);
      ctx.lineTo(fx + fSize * fDir, fy + fSize * 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx - fSize * 0.4 * fDir, fy - fSize * 0.25);
      ctx.lineTo(fx - fSize * 0.4 * fDir, fy + fSize * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Boat profile
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#7eb8dc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 38 * s, waterY);
    ctx.quadraticCurveTo(cx + 32 * s, waterY + 5 * s, cx + 20 * s, waterY + 6 * s);
    ctx.lineTo(cx - 20 * s, waterY + 6 * s);
    ctx.quadraticCurveTo(cx - 28 * s, waterY + 4 * s, cx - 32 * s, waterY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Deck
    ctx.fillStyle = '#3b1a08';
    ctx.fillRect(cx - 30 * s, waterY - 2, 60 * s, 3);

    // Cabin
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(cx - 5 * s, waterY - 8 * s, 18 * s, 6 * s, 2);
    ctx.fill();
    ctx.stroke();

    // Keel
    ctx.fillStyle = '#1a3a5c';
    ctx.strokeStyle = '#2d5f7a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 3 * s, waterY + 6 * s);
    ctx.lineTo(cx - 4 * s, waterY + 22 * s);
    ctx.lineTo(cx + 4 * s, waterY + 22 * s);
    ctx.lineTo(cx + 3 * s, waterY + 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bulb keel
    ctx.fillStyle = '#2d5f7a';
    ctx.strokeStyle = '#3d7f9a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, waterY + 23 * s, 7 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mast
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + 6 * s, waterY - 2);
    ctx.lineTo(cx + 6 * s, waterY - 44 * s);
    ctx.stroke();

    // Forestay
    ctx.strokeStyle = '#4a7a9e40';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 6 * s, waterY - 42 * s);
    ctx.lineTo(cx + 36 * s, waterY - 1);
    ctx.stroke();

    // Backstay
    ctx.beginPath();
    ctx.moveTo(cx + 6 * s, waterY - 42 * s);
    ctx.lineTo(cx - 30 * s, waterY - 1);
    ctx.stroke();

    // Sail
    if (cfg.mode !== 'rotor') {
      ctx.fillStyle = 'rgba(255, 234, 0, 0.08)';
      ctx.strokeStyle = '#fde04750';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 6 * s, waterY - 42 * s);
      ctx.quadraticCurveTo(cx + 24 * s, waterY - 24 * s, cx + 6 * s, waterY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Rudder
    ctx.fillStyle = '#2d5f7a70';
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, waterY + 2);
    ctx.lineTo(cx - 30 * s, waterY + 10 * s);
    ctx.lineTo(cx - 28 * s, waterY + 10 * s);
    ctx.lineTo(cx - 28 * s, waterY + 2);
    ctx.closePath();
    ctx.fill();

    // Depth labels
    ctx.font = '7px Inter';
    ctx.fillStyle = '#2d5f7a70';
    ctx.fillText('0m', vx + 6, waterY - 3);
    ctx.fillText('-3m', vx + 6, waterY + 30);
    ctx.fillText('-8m', vx + 6, waterY + 60);

    // Border
    ctx.strokeStyle = '#1a3a5c70';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 8);
    ctx.stroke();

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // FRONT VIEW — Heel cross-section with underwater
  // ═══════════════════════════════════════════════════════════════
  private drawFrontView(cfg: Config, phys: PhysicsState, w: number, h: number): void {
    const ctx = this.ctx;
    const t = this.time;
    const vw = 200;
    const vh = 180;
    const sideVw = 340;
    const vx = w - sideVw - vw - 20;
    const vy = h - vh - 12;

    // Heel angle
    const mastH = 10;
    const hM = phys.heelN * mastH;
    const rM = cfg.mass * 9.81 * 0.35;
    const heelRad = rM > 0 ? Math.asin(Math.min(1, Math.max(-1, hM / rM))) : 0;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 8);
    ctx.clip();

    const bg = ctx.createLinearGradient(vx, vy, vx, vy + vh);
    bg.addColorStop(0, '#0c1628');
    bg.addColorStop(0.38, '#0a2040');
    bg.addColorStop(0.40, '#062a50');
    bg.addColorStop(1, '#021428');
    ctx.fillStyle = bg;
    ctx.fillRect(vx, vy, vw, vh);

    // Title
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(vx, vy, vw, 18);
    ctx.font = 'bold 8px Inter';
    ctx.fillStyle = '#3a6a8e';
    ctx.fillText('FRONT VIEW', vx + 8, vy + 12);

    const heelDeg = (heelRad * 180 / Math.PI).toFixed(1);
    const hc = Math.abs(heelRad) > 0.35 ? '#ff5252' : Math.abs(heelRad) > 0.17 ? '#ff9f43' : '#06d6a0';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.fillStyle = hc;
    ctx.textAlign = 'right';
    ctx.fillText(`${heelDeg}\u00B0`, vx + vw - 8, vy + 12);
    ctx.textAlign = 'left';

    const cx = vx + vw / 2;
    const waterY = vy + vh * 0.40;
    const sc = 1.8;

    // Water
    const og = ctx.createLinearGradient(vx, waterY, vx, vy + vh);
    og.addColorStop(0, 'rgba(6, 42, 80, 0.12)');
    og.addColorStop(0.5, 'rgba(4, 28, 55, 0.28)');
    og.addColorStop(1, 'rgba(2, 14, 30, 0.45)');
    ctx.fillStyle = og;
    ctx.fillRect(vx, waterY, vw, vy + vh - waterY);

    // Animated waterline
    ctx.strokeStyle = '#06d6a050';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vx, waterY);
    for (let wx = vx; wx <= vx + vw; wx += 2) {
      ctx.lineTo(wx, waterY + Math.sin((wx - vx) * 0.08 + t * 1.8) * 0.8);
    }
    ctx.stroke();

    // Light shafts in front view
    ctx.save();
    ctx.globalAlpha = 0.025;
    for (let i = 0; i < 3; i++) {
      const shX = cx - 30 + i * 30;
      const drift = Math.sin(t * 0.4 + i) * 3;
      const sg = ctx.createLinearGradient(shX, waterY, shX + drift, vy + vh);
      sg.addColorStop(0, '#38bdf8');
      sg.addColorStop(1, '#38bdf800');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(shX - 4, waterY);
      ctx.lineTo(shX + 4, waterY);
      ctx.lineTo(shX + drift + 18, vy + vh);
      ctx.lineTo(shX + drift - 18, vy + vh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Bioluminescent
    for (let i = 0; i < 6; i++) {
      const px = vx + 15 + ((i * 31) % (vw - 30));
      const py = waterY + 20 + ((i * 23) % (vh * 0.45));
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.9 + i));
      ctx.fillStyle = `rgba(56, 189, 248, ${0.08 * pulse})`;
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Heel reference arc
    ctx.strokeStyle = '#1a3a5c45';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(cx, waterY, 40, -Math.PI, 0);
    ctx.stroke();

    for (const deg of [-30, -20, -10, 10, 20, 30]) {
      const r = deg * Math.PI / 180;
      ctx.fillStyle = '#1a3a5c50';
      ctx.beginPath();
      ctx.arc(cx + 38 * Math.sin(r), waterY - 38 * Math.cos(r), 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);

    // Heel tick labels
    ctx.save();
    ctx.font = '6px Inter';
    ctx.fillStyle = '#2a5a7e40';
    ctx.fillText('-30', cx - 42, waterY - 28);
    ctx.fillText('30', cx + 36, waterY - 28);
    ctx.restore();

    // Rotated boat cross-section
    ctx.save();
    ctx.translate(cx, waterY);
    ctx.rotate(heelRad);

    // Hull ellipse
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#7eb8dc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 4 * sc, 18 * sc, 7 * sc, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Deck
    ctx.fillStyle = '#3b1a08';
    ctx.fillRect(-18 * sc, 0, 36 * sc, 3);

    // Cabin
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.roundRect(-6 * sc, -5 * sc, 12 * sc, 5 * sc, 2);
    ctx.fill();
    ctx.stroke();

    // Keel
    ctx.fillStyle = '#1a3a5c';
    ctx.beginPath();
    ctx.moveTo(-2 * sc, 11 * sc);
    ctx.lineTo(0, 26 * sc);
    ctx.lineTo(2 * sc, 11 * sc);
    ctx.closePath();
    ctx.fill();

    // Bulb
    ctx.fillStyle = '#2d5f7a';
    ctx.beginPath();
    ctx.ellipse(0, 27 * sc, 5 * sc, 2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mast
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -36 * sc);
    ctx.stroke();

    // Shrouds
    ctx.strokeStyle = '#4a7a9e35';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -34 * sc);
    ctx.lineTo(-17 * sc, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -34 * sc);
    ctx.lineTo(17 * sc, 0);
    ctx.stroke();

    // Spreaders
    ctx.strokeStyle = '#4a7a9e50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8 * sc, -20 * sc);
    ctx.lineTo(8 * sc, -20 * sc);
    ctx.stroke();

    ctx.restore();

    // Border
    ctx.strokeStyle = '#1a3a5c70';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 8);
    ctx.stroke();

    ctx.restore();
  }
}

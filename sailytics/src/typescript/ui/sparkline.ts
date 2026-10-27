import type { TimeSeriesBuffer } from '../data/timeseries';

/**
 * Mini canvas line chart with gradient fill, devicePixelRatio-aware
 */
export class Sparkline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: TimeSeriesBuffer;
  private color: string;

  constructor(container: HTMLElement, buffer: TimeSeriesBuffer, color: string = '#22d3ee') {
    this.buffer = buffer;
    this.color = color;

    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('sparkline-canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    container.appendChild(this.canvas);
    this.resize();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    const data = this.buffer.getAll();
    if (data.length < 2) return;

    // Find min/max for scaling
    let min = Infinity;
    let max = -Infinity;
    for (const pt of data) {
      if (pt.value < min) min = pt.value;
      if (pt.value > max) max = pt.value;
    }

    // Add 10% padding
    const range = max - min;
    if (range === 0) return;
    min -= range * 0.1;
    max += range * 0.1;

    // Draw line
    this.ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((data[i].value - min) / (max - min)) * h;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    // Stroke line
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Fill gradient
    const lastX = w;
    const lastY = h - ((data[data.length - 1].value - min) / (max - min)) * h;
    this.ctx.lineTo(lastX, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();

    const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `${this.color}40`);
    gradient.addColorStop(1, `${this.color}00`);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  destroy(): void {
    this.canvas.remove();
  }
}

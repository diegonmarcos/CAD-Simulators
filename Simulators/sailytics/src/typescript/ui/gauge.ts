/**
 * SVG-based circular arc gauge with B&G instrument aesthetic
 * 270-degree sweep, tick marks, colored zones, digital center readout, glow
 */

export interface GaugeConfig {
  min: number;
  max: number;
  value: number;
  label: string;
  unit: string;
  zones?: { from: number; to: number; color: string }[];
  glowColor?: string;
}

export class CircularGauge {
  private svg: SVGSVGElement;
  private valueText: SVGTextElement;
  private arcPath: SVGPathElement;
  private config: GaugeConfig;

  constructor(container: HTMLElement, config: GaugeConfig) {
    this.config = config;

    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 200 200');
    this.svg.classList.add('gauge-svg');

    // Background arc
    const bgArc = this.createArc(70, 15, '#1e293b');
    this.svg.appendChild(bgArc);

    // Tick marks
    this.createTicks();

    // Value arc (will be updated)
    this.arcPath = this.createArc(70, 15, config.glowColor || '#22d3ee');
    this.arcPath.classList.add('gauge-arc');
    if (config.glowColor) {
      this.arcPath.style.filter = `drop-shadow(0 0 6px ${config.glowColor})`;
    }
    this.svg.appendChild(this.arcPath);

    // Center label
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', '100');
    labelText.setAttribute('y', '90');
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('class', 'gauge-label');
    labelText.textContent = config.label;
    this.svg.appendChild(labelText);

    // Center value
    this.valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.valueText.setAttribute('x', '100');
    this.valueText.setAttribute('y', '115');
    this.valueText.setAttribute('text-anchor', 'middle');
    this.valueText.setAttribute('class', 'gauge-value');
    this.svg.appendChild(this.valueText);

    // Unit
    const unitText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    unitText.setAttribute('x', '100');
    unitText.setAttribute('y', '130');
    unitText.setAttribute('text-anchor', 'middle');
    unitText.setAttribute('class', 'gauge-unit');
    unitText.textContent = config.unit;
    this.svg.appendChild(unitText);

    container.appendChild(this.svg);
    this.update(config.value);
  }

  private createArc(radius: number, strokeWidth: number, color: string): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth.toString());
    path.setAttribute('stroke-linecap', 'round');
    return path;
  }

  private createTicks(): void {
    const numTicks = 9; // 270 degrees / 30 = 9 ticks
    const startAngle = 135; // Start at bottom-left (135 degrees)

    for (let i = 0; i <= numTicks; i++) {
      const angle = startAngle + (i * 270) / numTicks;
      const rad = (angle * Math.PI) / 180;
      const x1 = 100 + 65 * Math.cos(rad);
      const y1 = 100 + 65 * Math.sin(rad);
      const x2 = 100 + 55 * Math.cos(rad);
      const y2 = 100 + 55 * Math.sin(rad);

      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x1.toString());
      tick.setAttribute('y1', y1.toString());
      tick.setAttribute('x2', x2.toString());
      tick.setAttribute('y2', y2.toString());
      tick.setAttribute('stroke', '#475569');
      tick.setAttribute('stroke-width', i % 3 === 0 ? '2' : '1');
      this.svg.appendChild(tick);
    }
  }

  private polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  private describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(cx, cy, radius, endAngle);
    const end = this.polarToCartesian(cx, cy, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  update(value: number): void {
    this.config.value = value;

    // Update value text
    this.valueText.textContent = value.toFixed(1);

    // Update arc path
    const pct = (value - this.config.min) / (this.config.max - this.config.min);
    const clampedPct = Math.max(0, Math.min(1, pct));
    const startAngle = 135;
    const sweepAngle = clampedPct * 270;
    const endAngle = startAngle + sweepAngle;

    const arcD = this.describeArc(100, 100, 70, startAngle, endAngle);
    this.arcPath.setAttribute('d', arcD);

    // Update color based on zones
    if (this.config.zones) {
      for (const zone of this.config.zones) {
        if (value >= zone.from && value <= zone.to) {
          this.arcPath.setAttribute('stroke', zone.color);
          this.arcPath.style.filter = `drop-shadow(0 0 6px ${zone.color})`;
          break;
        }
      }
    }
  }

  setValue(value: number): void {
    this.update(value);
  }

  destroy(): void {
    this.svg.remove();
  }
}

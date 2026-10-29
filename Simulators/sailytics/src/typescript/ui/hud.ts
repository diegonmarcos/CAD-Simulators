import type { PhysicsState, DerivedMetrics } from '../types/index';
import type { TimeSeriesBuffer } from '../data/timeseries';
import { KTS_TO_MS } from '../physics/constants';
import { CircularGauge } from './gauge';
import { Sparkline } from './sparkline';
import { calculateTrend, getTrendArrow, getTrendClass } from './trend';
import { GAUGE_CONFIG } from '../data/defaults.js';

function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element;
}

interface HUDState {
  gauges: {
    aws: CircularGauge;
    vmg: CircularGauge;
    bs: CircularGauge;
  };
  sparklines: {
    awa: Sparkline;
    heel: Sparkline;
  };
}

let hudState: HUDState | null = null;

/**
 * Initialize HUD with gauges and sparklines
 */
export function initHUD(
  tsAWS: TimeSeriesBuffer,
  tsVMG: TimeSeriesBuffer,
  tsHeel: TimeSeriesBuffer
): void {
  // Create gauges from config
  const gaugeAWS = new CircularGauge(el('gauge-aws'), {
    ...GAUGE_CONFIG.aws,
    value: 0,
  });

  const gaugeVMG = new CircularGauge(el('gauge-vmg'), {
    ...GAUGE_CONFIG.vmg,
    value: 0,
  });

  const gaugeBS = new CircularGauge(el('gauge-bs'), {
    ...GAUGE_CONFIG.bs,
    value: 0,
  });

  // Create sparklines
  const sparkAWA = new Sparkline(el('spark-awa'), tsAWS, '#22d3ee');
  const sparkHeel = new Sparkline(el('spark-heel'), tsHeel, '#fb923c');

  hudState = {
    gauges: {
      aws: gaugeAWS,
      vmg: gaugeVMG,
      bs: gaugeBS,
    },
    sparklines: {
      awa: sparkAWA,
      heel: sparkHeel,
    },
  };
}

/**
 * Update HUD with latest physics state and metrics
 */
export function updateHUD(
  phys: PhysicsState,
  metrics: DerivedMetrics,
  boatSpeed: number,
  tsAWS: TimeSeriesBuffer,
  tsHeel: TimeSeriesBuffer
): void {
  // Update gauges
  if (hudState) {
    const awsKts = phys.aws / KTS_TO_MS;
    const vmgKts = metrics.vmg / KTS_TO_MS;

    hudState.gauges.aws.setValue(awsKts);
    hudState.gauges.vmg.setValue(vmgKts);
    hudState.gauges.bs.setValue(boatSpeed);

    // Update sparklines
    hudState.sparklines.awa.render();
    hudState.sparklines.heel.render();
  }

  // Update text values
  el('out-awa').textContent = `${Math.abs(Math.round(phys.awa))}° ${phys.awa > 0 ? 'S' : 'P'}`;
  el('out-twa').textContent = `${Math.abs(Math.round(phys.twa))}° ${phys.twa > 0 ? 'S' : 'P'}`;
  el('out-heel-angle').textContent = `${metrics.heelAngle.toFixed(1)}°`;
  el('out-leeway').textContent = `${metrics.leewayAngle.toFixed(1)}°`;
  el('out-cog').textContent = `${Math.round(metrics.cog)}°T`;
  el('out-polar').textContent = `${Math.round(metrics.polarEfficiency)}%`;

  const accEl = el('out-acc');
  accEl.textContent = `${phys.acc > 0 ? '+' : ''}${phys.acc.toFixed(3)} m/s²`;
  accEl.className = `data-value ${phys.acc >= 0 ? 'data-value--yellow' : 'data-value--red'}`;

  el('out-drive').textContent = `${Math.round(phys.driveN).toLocaleString()} N`;
  el('out-heel').textContent = `${Math.round(phys.heelN).toLocaleString()} N`;
  el('out-hdrag').textContent = `${Math.round(phys.hullDragN).toLocaleString()} N`;
  el('out-wdrag').textContent = `${Math.round(phys.waveDragN).toLocaleString()} N`;
  el('out-alpha').textContent = phys.rotor.alpha.toFixed(2);
  el('out-trim').textContent = metrics.optimalTrimSuggestion;

  // Update trend indicators
  updateTrend('trend-twa', phys.twa, 0);
  updateTrend('trend-acc', phys.acc, 0);

  // Stall warning
  const stallEl = el('trend-stall');
  if (metrics.stallWarning) {
    stallEl.innerHTML = '<span class="status-led status-led--red"></span> STALLED';
    stallEl.className = 'data-card__trend trend--down';
  } else {
    stallEl.innerHTML = '<span class="status-led status-led--green"></span> Normal';
    stallEl.className = 'data-card__trend trend--up';
  }
}

/**
 * Update a trend indicator element
 */
function updateTrend(elementId: string, current: number, average: number): void {
  const trend = calculateTrend(current, average, 0.05);
  const trendEl = el(elementId);
  const arrow = getTrendArrow(trend.direction);
  const className = getTrendClass(trend.direction);

  trendEl.textContent = arrow;
  trendEl.className = `data-card__trend ${className}`;
}

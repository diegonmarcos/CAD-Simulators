import type { TimeSeriesPoint } from '../types/index';

/**
 * Ring buffer for time-series data with configurable time window
 */
export class TimeSeriesBuffer {
  private buffer: TimeSeriesPoint[] = [];
  private maxAge: number; // seconds

  constructor(windowSeconds: number = 60) {
    this.maxAge = windowSeconds;
  }

  /**
   * Add a new data point and prune old entries
   */
  push(t: number, value: number): void {
    this.buffer.push({ t, value });

    // Remove entries older than maxAge
    const cutoff = t - this.maxAge;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) {
      this.buffer.shift();
    }
  }

  /**
   * Get all data points in the buffer
   */
  getAll(): TimeSeriesPoint[] {
    return this.buffer;
  }

  /**
   * Get the last N data points
   */
  getLast(n: number): TimeSeriesPoint[] {
    return this.buffer.slice(-n);
  }

  /**
   * Get the most recent value, or null if empty
   */
  getLatest(): number | null {
    if (this.buffer.length === 0) return null;
    return this.buffer[this.buffer.length - 1].value;
  }

  /**
   * Get rolling average over last N seconds
   */
  getAverage(seconds: number): number | null {
    if (this.buffer.length === 0) return null;

    const latestTime = this.buffer[this.buffer.length - 1].t;
    const cutoff = latestTime - seconds;

    const recentPoints = this.buffer.filter(p => p.t >= cutoff);
    if (recentPoints.length === 0) return null;

    const sum = recentPoints.reduce((acc, p) => acc + p.value, 0);
    return sum / recentPoints.length;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer size
   */
  get length(): number {
    return this.buffer.length;
  }
}

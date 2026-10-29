/**
 * Trend indicator - compares current value to rolling average
 * Returns up/down/stable state
 */

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendState {
  direction: TrendDirection;
  percentage: number; // Percentage change
}

/**
 * Calculate trend by comparing current value to average
 */
export function calculateTrend(current: number, average: number, threshold: number = 0.05): TrendState {
  if (average === 0) {
    return { direction: 'stable', percentage: 0 };
  }

  const change = (current - average) / Math.abs(average);

  if (Math.abs(change) < threshold) {
    return { direction: 'stable', percentage: 0 };
  }

  return {
    direction: change > 0 ? 'up' : 'down',
    percentage: Math.abs(change) * 100,
  };
}

/**
 * Get arrow symbol for trend direction
 */
export function getTrendArrow(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'stable':
      return '→';
  }
}

/**
 * Get CSS class for trend direction
 */
export function getTrendClass(direction: TrendDirection): string {
  return `trend--${direction}`;
}

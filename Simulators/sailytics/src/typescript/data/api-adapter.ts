import type { WindAPIData, BathymetryData, FishSonarData, GPSData, Config } from '../types/index';

/**
 * Data source interface for external APIs
 * Allows seamless switching between slider input and real data
 */
export interface DataSource {
  /**
   * Get current wind data (true wind speed and direction)
   */
  getWind(): Promise<WindAPIData | null>;

  /**
   * Get bathymetry data for current position
   */
  getBathymetry(lat: number, lon: number, radiusKm: number): Promise<BathymetryData[]>;

  /**
   * Get fish/sonar data
   */
  getFishSonar(): Promise<FishSonarData[]>;

  /**
   * Get GPS position and motion data
   */
  getGPS(): Promise<GPSData | null>;
}

/**
 * Default implementation using slider values (current behavior)
 */
export class SliderDataSource implements DataSource {
  constructor(private config: Config) {}

  async getWind(): Promise<WindAPIData | null> {
    // Return null to indicate "use slider values"
    return null;
  }

  async getBathymetry(lat: number, lon: number, radiusKm: number): Promise<BathymetryData[]> {
    // Return empty array - no bathymetry data from sliders
    return [];
  }

  async getFishSonar(): Promise<FishSonarData[]> {
    // Return empty array - no fish data from sliders
    return [];
  }

  async getGPS(): Promise<GPSData | null> {
    // Return null to indicate "use slider values for heading/speed"
    return null;
  }

  /**
   * Update config reference (for when sliders change)
   */
  setConfig(config: Config): void {
    this.config = config;
  }
}

/**
 * Example: HTTP API data source
 * This would connect to real weather/navigation APIs
 */
export class HTTPDataSource implements DataSource {
  constructor(private baseUrl: string) {}

  async getWind(): Promise<WindAPIData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/wind`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch wind data:', error);
      return null;
    }
  }

  async getBathymetry(lat: number, lon: number, radiusKm: number): Promise<BathymetryData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/bathymetry?lat=${lat}&lon=${lon}&radius=${radiusKm}`
      );
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch bathymetry data:', error);
      return [];
    }
  }

  async getFishSonar(): Promise<FishSonarData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sonar`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch sonar data:', error);
      return [];
    }
  }

  async getGPS(): Promise<GPSData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/gps`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch GPS data:', error);
      return null;
    }
  }
}

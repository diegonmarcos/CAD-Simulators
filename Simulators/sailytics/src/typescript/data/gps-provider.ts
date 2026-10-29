import type { GPSData } from '../types/index';

/**
 * GPS data provider using browser Geolocation API
 */
export class BrowserGPSProvider {
  private lastPosition: GeolocationPosition | null = null;
  private watchId: number | null = null;

  /**
   * Start watching position
   */
  start(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastPosition = position;
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      }
    );
  }

  /**
   * Stop watching position
   */
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Get current GPS data
   */
  async getCurrent(): Promise<GPSData | null> {
    if (!this.lastPosition) {
      return null;
    }

    const coords = this.lastPosition.coords;

    return {
      lat: coords.latitude,
      lon: coords.longitude,
      speed: coords.speed || 0, // m/s
      heading: coords.heading || 0, // degrees
      timestamp: this.lastPosition.timestamp,
    };
  }

  /**
   * Request single position (one-time)
   */
  async requestPosition(): Promise<GPSData | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          resolve({
            lat: coords.latitude,
            lon: coords.longitude,
            speed: coords.speed || 0,
            heading: coords.heading || 0,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.error('Failed to get position:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
        }
      );
    });
  }
}

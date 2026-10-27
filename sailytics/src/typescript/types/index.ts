export interface Vec2D {
  x: number;
  y: number;
}

export type PropulsionMode = 'sail' | 'rotor' | 'hybrid';

export interface Config {
  mode: PropulsionMode;
  tws: number;   // True wind speed (kts)
  twd: number;   // True wind direction (deg)
  decl: number;  // Magnetic declination (deg)
  bs: number;    // Boat speed (kts)
  hdg: number;   // Heading true (deg)
  mass: number;  // Displacement (kg)
  sang: number;  // Sail trim angle (deg)
  sarea: number; // Sail area (m²)
  rpm: number;   // Rotor RPM
  rh: number;    // Rotor height (m)
  rd: number;    // Rotor diameter (m)
}

export interface ForceResult {
  L: number;     // Lift magnitude (N)
  D: number;     // Drag magnitude (N)
  vL: Vec2D;     // Lift vector
  vD: Vec2D;     // Drag vector
  drive: number; // Forward component (N)
  heel: number;  // Lateral component (N)
  alpha: number; // Spin ratio (rotor only)
}

export interface PhysicsState {
  vTW: Vec2D;
  vBoat: Vec2D;
  vAW: Vec2D;
  awa: number;
  aws: number;
  twa: number;
  sail: ForceResult;
  rotor: ForceResult;
  driveN: number;
  heelN: number;
  hullDragN: number;
  waveDragN: number;
  acc: number;
  vTotDrive: Vec2D;
  vTotHeel: Vec2D;
  vHullDrag: Vec2D;
  stalled: boolean;
}

export interface DerivedMetrics {
  vmg: number;          // Velocity made good (m/s)
  polarEfficiency: number; // Percentage of optimal speed
  leewayAngle: number;  // Drift angle (deg)
  heelAngle: number;    // Heel angle (deg)
  cog: number;          // Course over ground (deg)
  rightingMoment: number; // Nm
  optimalTrimSuggestion: string;
  stallWarning: boolean;
}

export interface TimeSeriesPoint {
  t: number;
  value: number;
}

export interface PolarPoint {
  twa: number;  // True wind angle
  speed: number; // Boat speed at this angle
}

export interface BathymetryData {
  lat: number;
  lon: number;
  depth: number;
}

export interface FishSonarData {
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface WindAPIData {
  tws: number;
  twd: number;
  timestamp: number;
}

export interface GPSData {
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  timestamp: number;
}

// JSON data exported as JS module for CORS-free loading from file:// protocol
export const BOAT_DEFAULTS = {
  mode: 'sail',
  tws: 15,
  twd: 45,
  decl: 10,
  bs: 6,
  hdg: 0,
  mass: 5000,
  sang: 35,
  sarea: 35,
  rpm: 180,
  rh: 12,
  rd: 2.5,
};

export const GAUGE_CONFIG = {
  aws: {
    min: 0,
    max: 50,
    label: 'AWS',
    unit: 'kts',
    zones: [
      { from: 0, to: 10, color: '#22c55e' },
      { from: 10, to: 25, color: '#22d3ee' },
      { from: 25, to: 50, color: '#ef4444' },
    ],
    glowColor: '#22d3ee',
  },
  vmg: {
    min: -5,
    max: 15,
    label: 'VMG',
    unit: 'kts',
    zones: [
      { from: -5, to: 0, color: '#ef4444' },
      { from: 0, to: 8, color: '#22d3ee' },
      { from: 8, to: 15, color: '#22c55e' },
    ],
    glowColor: '#22c55e',
  },
  bs: {
    min: 0,
    max: 30,
    label: 'BOAT SPEED',
    unit: 'kts',
    glowColor: '#38bdf8',
  },
};

export const PHYSICS_CONSTANTS = {
  ktsToMs: 0.51444,
  rhoAir: 1.225,
  rhoWater: 1025,
  hullDragCoef: 0.08,
  waterlineLength: 10,
  beam: 3.5,
  gravity: 9.81,
  keelArea: 2.5,
  stallAoa: 18,
  kgHeight: 1.2,
  rightingArmCoef: 0.35,
};

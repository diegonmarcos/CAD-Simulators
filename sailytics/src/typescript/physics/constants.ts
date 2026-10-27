import { PHYSICS_CONSTANTS } from '../data/defaults.js';

export const KTS_TO_MS = PHYSICS_CONSTANTS.ktsToMs;
export const RHO_AIR = PHYSICS_CONSTANTS.rhoAir;
export const RHO_WATER = PHYSICS_CONSTANTS.rhoWater;
export const HULL_DRAG_COEF = PHYSICS_CONSTANTS.hullDragCoef;

// Hull geometry for wave resistance
export const WATERLINE_LENGTH = PHYSICS_CONSTANTS.waterlineLength; // m
export const BEAM = PHYSICS_CONSTANTS.beam; // m

// Stability constants
export const KG_HEIGHT = PHYSICS_CONSTANTS.kgHeight; // m (center of gravity above keel)
export const RIGHTING_ARM_COEF = PHYSICS_CONSTANTS.rightingArmCoef; // m/deg
export const GRAVITY = PHYSICS_CONSTANTS.gravity; // m/s²

// Keel geometry
export const KEEL_AREA = PHYSICS_CONSTANTS.keelArea; // m² projected lateral area

// Aerodynamic limits
export const STALL_AOA_DEG = PHYSICS_CONSTANTS.stallAoa; // degrees angle of attack

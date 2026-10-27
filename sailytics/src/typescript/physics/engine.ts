import type { Config, PhysicsState, ForceResult } from '../types/index';
import {
  KTS_TO_MS,
  RHO_AIR,
  RHO_WATER,
  HULL_DRAG_COEF,
  WATERLINE_LENGTH,
  GRAVITY,
  STALL_AOA_DEG,
} from './constants';
import * as V from './vec';

function emptyForce(): ForceResult {
  return { L: 0, D: 0, vL: { x: 0, y: 0 }, vD: { x: 0, y: 0 }, drive: 0, heel: 0, alpha: 0 };
}

export function computePhysics(cfg: Config): PhysicsState {
  const tws = cfg.tws * KTS_TO_MS;
  const bs = cfg.bs * KTS_TO_MS;

  const vTW = V.fromAngle(cfg.twd + 180, tws);
  const vBoat = V.fromAngle(cfg.hdg, bs);
  const vAW = V.sub(vTW, vBoat);
  const aws = V.magnitude(vAW);

  const awDir = V.toAngle(vAW);
  const awNorm = V.normalize(vAW);

  let awa = ((awDir + 180) % 360) - cfg.hdg;
  if (awa > 180) awa -= 360;
  if (awa < -180) awa += 360;

  // True wind angle
  let twa = cfg.twd - cfg.hdg;
  if (twa > 180) twa -= 360;
  if (twa < -180) twa += 360;

  const dynP = 0.5 * RHO_AIR * aws * aws;
  const fwd = V.fromAngle(cfg.hdg, 1);
  const side = V.fromAngle(cfg.hdg + 90, 1);

  let sail = emptyForce();
  let rotor = emptyForce();
  let stalled = false;

  // Sail forces
  if (cfg.mode === 'sail' || cfg.mode === 'hybrid') {
    const sailRad = (cfg.hdg + cfg.sang) * (Math.PI / 180);
    const aoa = Math.atan2(vAW.y, vAW.x) - Math.atan2(Math.cos(sailRad), Math.sin(sailRad));
    const aoaDeg = Math.abs(aoa * (180 / Math.PI));

    // Stall detection
    if (aoaDeg > STALL_AOA_DEG) {
      stalled = true;
    }

    const cl = 1.4 * Math.sin(2 * aoa);
    const cd = 0.15 + 1.1 * Math.pow(Math.sin(aoa), 2);
    const liftDir = V.fromAngle(awDir - 90 * Math.sign(cl), 1);

    sail = {
      L: dynP * cfg.sarea * Math.abs(cl),
      D: dynP * cfg.sarea * cd,
      vL: V.scale(liftDir, dynP * cfg.sarea * Math.abs(cl)),
      vD: V.scale(awNorm, dynP * cfg.sarea * cd),
      drive: 0,
      heel: 0,
      alpha: 0,
    };
    const tot = V.add(sail.vL, sail.vD);
    sail.drive = V.dot(tot, fwd);
    sail.heel = V.dot(tot, side);
  }

  // Rotor forces (Magnus effect)
  if (cfg.mode === 'rotor' || cfg.mode === 'hybrid') {
    const omega = cfg.rpm * ((2 * Math.PI) / 60);
    const U = omega * (cfg.rd / 2);
    const alpha = aws > 0.1 ? U / aws : 0;
    const cl = Math.min(Math.abs(alpha) * 2.6, 9.5);
    const cd = 0.6 + 0.45 * Math.abs(alpha);
    const liftSign = cfg.rpm >= 0 ? -1 : 1;
    const liftDir = V.fromAngle(awDir + 90 * liftSign, 1);

    const projArea = cfg.rh * cfg.rd;
    rotor = {
      L: dynP * projArea * cl,
      D: dynP * projArea * cd,
      vL: V.scale(liftDir, dynP * projArea * cl),
      vD: V.scale(awNorm, dynP * projArea * cd),
      drive: 0,
      heel: 0,
      alpha,
    };
    const tot = V.add(rotor.vL, rotor.vD);
    rotor.drive = V.dot(tot, fwd);
    rotor.heel = V.dot(tot, side);
  }

  const driveN = sail.drive + rotor.drive;
  const heelN = sail.heel + rotor.heel;
  const hullDragN = HULL_DRAG_COEF * RHO_WATER * bs * bs;

  // Wave resistance (Froude number based)
  // Fn = v / sqrt(g * L), grows exponentially near hull speed (Fn ~0.4)
  const froude = bs > 0 ? bs / Math.sqrt(GRAVITY * WATERLINE_LENGTH) : 0;
  const waveDragN = 0.001 * Math.exp(3.5 * froude) * RHO_WATER * bs * bs;

  const totalDrag = hullDragN + waveDragN;

  return {
    vTW,
    vBoat,
    vAW,
    awa,
    aws,
    twa,
    sail,
    rotor,
    driveN,
    heelN,
    hullDragN,
    waveDragN,
    acc: (driveN - totalDrag) / cfg.mass,
    vTotDrive: V.scale(fwd, driveN),
    vTotHeel: V.scale(side, heelN),
    vHullDrag: V.scale(V.fromAngle(cfg.hdg + 180, 1), totalDrag),
    stalled,
  };
}

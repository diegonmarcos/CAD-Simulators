import type { Vec2D } from '../types/index';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function fromAngle(deg: number, mag: number): Vec2D {
  const r = deg * DEG_TO_RAD;
  return { x: mag * Math.sin(r), y: mag * Math.cos(r) };
}

export function add(v1: Vec2D, v2: Vec2D): Vec2D {
  return { x: v1.x + v2.x, y: v1.y + v2.y };
}

export function sub(v1: Vec2D, v2: Vec2D): Vec2D {
  return { x: v1.x - v2.x, y: v1.y - v2.y };
}

export function magnitude(v: Vec2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vec2D): Vec2D {
  const m = magnitude(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
}

export function scale(v: Vec2D, n: number): Vec2D {
  return { x: v.x * n, y: v.y * n };
}

export function dot(v1: Vec2D, v2: Vec2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

export function toAngle(v: Vec2D): number {
  return Math.atan2(v.x, v.y) * RAD_TO_DEG;
}

export function rotate(v: Vec2D, angleDeg: number): Vec2D {
  const r = angleDeg * DEG_TO_RAD;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

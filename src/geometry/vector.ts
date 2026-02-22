export interface Vec2 {
  x: number;
  y: number;
}

export const EPSILON = 1e-6;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, y: a.y * scalar };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  if (len < EPSILON) {
    return { x: 0, y: 0 };
  }
  return { x: a.x / len, y: a.y / len };
}

export function rotate(v: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    x: v.x * c - v.y * s,
    y: v.x * s + v.y * c,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function angleToVector(radians: number): Vec2 {
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

export function wrap(value: number, max: number): number {
  if (value < 0) {
    return ((value % max) + max) % max;
  }
  if (value >= max) {
    return value % max;
  }
  return value;
}

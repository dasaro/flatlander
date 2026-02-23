import { EPSILON, cross, dot, length, normalize, sub, vec } from './vector';
import type { Vec2 } from './vector';

function minimumPositive(values: Array<number | null>): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (value === null || value < 0) {
      continue;
    }
    if (best === null || value < best) {
      best = value;
    }
  }
  return best;
}

function edgeAt(vertices: Vec2[], index: number): { a: Vec2; b: Vec2 } {
  const wrappedA = ((index % vertices.length) + vertices.length) % vertices.length;
  const wrappedB = ((index + 1) % vertices.length + vertices.length) % vertices.length;
  const a = vertices[wrappedA];
  const b = vertices[wrappedB];
  if (!a || !b) {
    throw new Error('Invalid polygon edge for raycast.');
  }
  return { a, b };
}

export function raycastCircle(origin: Vec2, dir: Vec2, center: Vec2, radius: number): number | null {
  const safeRadius = Math.max(0, radius);
  const d = normalize(dir);
  if (length(d) <= EPSILON) {
    return null;
  }

  const oc = sub(origin, center);
  const b = dot(oc, d);
  const c = dot(oc, oc) - safeRadius * safeRadius;
  const discriminant = b * b - c;
  if (discriminant < -EPSILON) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(Math.max(0, discriminant));
  const t0 = -b - sqrtDiscriminant;
  const t1 = -b + sqrtDiscriminant;
  if (t0 >= 0) {
    return t0;
  }
  if (t1 >= 0) {
    return t1;
  }
  return null;
}

export function raycastSegment(origin: Vec2, dir: Vec2, a: Vec2, b: Vec2): number | null {
  const d = normalize(dir);
  if (length(d) <= EPSILON) {
    return null;
  }

  const segment = sub(b, a);
  const denominator = cross(d, segment);
  if (Math.abs(denominator) <= EPSILON) {
    return null;
  }

  const ao = sub(a, origin);
  const t = cross(ao, segment) / denominator;
  const u = cross(ao, d) / denominator;
  if (t < 0 || u < 0 || u > 1) {
    return null;
  }
  return t;
}

export function raycastConvexPolygon(origin: Vec2, dir: Vec2, vertices: Vec2[]): number | null {
  if (vertices.length < 3) {
    return null;
  }

  const hits: Array<number | null> = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const edge = edgeAt(vertices, i);
    hits.push(raycastSegment(origin, dir, edge.a, edge.b));
  }

  return minimumPositive(hits);
}

export function raycastSegmentCapsule(
  origin: Vec2,
  dir: Vec2,
  a: Vec2,
  b: Vec2,
  radius: number,
): number | null {
  const safeRadius = Math.max(0, radius);
  if (safeRadius <= EPSILON) {
    return raycastSegment(origin, dir, a, b);
  }

  const segment = sub(b, a);
  const segmentLength = length(segment);
  if (segmentLength <= EPSILON) {
    return raycastCircle(origin, dir, a, safeRadius);
  }

  const normal = {
    x: -segment.y / segmentLength,
    y: segment.x / segmentLength,
  };

  const quad = [
    vec(a.x + normal.x * safeRadius, a.y + normal.y * safeRadius),
    vec(b.x + normal.x * safeRadius, b.y + normal.y * safeRadius),
    vec(b.x - normal.x * safeRadius, b.y - normal.y * safeRadius),
    vec(a.x - normal.x * safeRadius, a.y - normal.y * safeRadius),
  ];

  const hits: Array<number | null> = [
    raycastConvexPolygon(origin, dir, quad),
    raycastCircle(origin, dir, a, safeRadius),
    raycastCircle(origin, dir, b, safeRadius),
  ];

  return minimumPositive(hits);
}

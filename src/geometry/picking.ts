import { EPSILON, clamp, distance } from './vector';
import type { Vec2 } from './vector';

function polygonVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Polygon vertex lookup failed while picking.');
  }
  return vertex;
}

export function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denominator = abx * abx + aby * aby;

  if (denominator <= EPSILON) {
    return distance(point, a);
  }

  const t = clamp((apx * abx + apy * aby) / denominator, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return Math.hypot(point.x - cx, point.y - cy);
}

export function pointInConvexPolygon(point: Vec2, vertices: Vec2[]): boolean {
  if (vertices.length < 3) {
    return false;
  }

  let sign = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = polygonVertex(vertices, i);
    const b = polygonVertex(vertices, i + 1);
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= EPSILON) {
      continue;
    }

    const currentSign = Math.sign(cross);
    if (sign === 0) {
      sign = currentSign;
      continue;
    }

    if (sign !== currentSign) {
      return false;
    }
  }

  return true;
}

export function distancePointToConvexPolygonEdges(point: Vec2, vertices: Vec2[]): number {
  if (vertices.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = polygonVertex(vertices, i);
    const b = polygonVertex(vertices, i + 1);
    best = Math.min(best, distancePointToSegment(point, a, b));
  }
  return best;
}

export function hitTestCircle(point: Vec2, center: Vec2, radius: number, tolerance: number): boolean {
  return distance(point, center) <= radius + tolerance;
}

export function hitTestSegment(point: Vec2, a: Vec2, b: Vec2, tolerance: number): boolean {
  return distancePointToSegment(point, a, b) <= tolerance;
}

export function hitTestPolygon(point: Vec2, vertices: Vec2[], tolerance: number): boolean {
  if (pointInConvexPolygon(point, vertices)) {
    return true;
  }

  return distancePointToConvexPolygonEdges(point, vertices) <= tolerance;
}

import type { SeededRng } from '../core/rng';
import { EPSILON, clamp, distance, normalize, sub, vec } from './vector';
import type { Vec2 } from './vector';

export function regularPolygonVertices(sides: number, radius: number): Vec2[] {
  const vertices: Vec2[] = [];
  const step = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i += 1) {
    const angle = i * step;
    vertices.push(vec(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return vertices;
}

export function radialPolygonVertices(sides: number, baseRadius: number, radial: number[]): Vec2[] {
  const step = (Math.PI * 2) / Math.max(3, sides);
  const vertices: Vec2[] = [];

  for (let i = 0; i < sides; i += 1) {
    const multiplier = radial[i] ?? 1;
    const radius = Math.max(EPSILON, baseRadius * multiplier);
    const angle = i * step;
    vertices.push(vec(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }

  return vertices;
}

export function radialDeviation(radial: number[]): number {
  if (radial.length === 0) {
    return 0;
  }

  const average = mean(radial);
  return stddev(radial, average);
}

export function isoscelesTriangleVertices(equalSideLength: number, baseRatio: number): Vec2[] {
  const side = Math.max(1, equalSideLength);
  const safeRatio = clamp(baseRatio, 0.01, 0.95);
  const base = side * safeRatio;
  const halfBase = base / 2;
  const height = Math.sqrt(Math.max(EPSILON, side * side - halfBase * halfBase));

  // Center on centroid so random rotation around transform origin is unbiased.
  const baseY = -height / 3;
  const apexY = (2 * height) / 3;

  return [
    vec(-halfBase, baseY),
    vec(halfBase, baseY),
    vec(0, apexY),
  ];
}

function wrappedVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Polygon vertex lookup failed.');
  }
  return vertex;
}

function signedArea(vertices: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const curr = wrappedVertex(vertices, i);
    const next = wrappedVertex(vertices, i + 1);
    area += curr.x * next.y - next.x * curr.y;
  }
  return area / 2;
}

export function ensureCounterClockwise(vertices: Vec2[]): Vec2[] {
  if (signedArea(vertices) >= 0) {
    return vertices;
  }
  return [...vertices].reverse();
}

export function isConvex(vertices: Vec2[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  const pts = ensureCounterClockwise(vertices);
  let hasNonPositive = false;
  for (let i = 0; i < pts.length; i += 1) {
    const a = wrappedVertex(pts, i);
    const b = wrappedVertex(pts, i + 1);
    const c = wrappedVertex(pts, i + 2);
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= EPSILON) {
      hasNonPositive = true;
      break;
    }
  }
  return !hasNonPositive;
}

export function isSimplePolygon(vertices: Vec2[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  const segments = vertices.map((start, i) => ({
    a: start,
    b: wrappedVertex(vertices, i + 1),
  }));

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === segments.length - 1)) {
        continue;
      }
      const segmentA = segments[i];
      const segmentB = segments[j];
      if (!segmentA || !segmentB) {
        continue;
      }
      if (segmentsIntersect(segmentA.a, segmentA.b, segmentB.a, segmentB.b)) {
        return false;
      }
    }
  }
  return true;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: Vec2, b: Vec2, c: Vec2): boolean {
  return (
    Math.min(a.x, c.x) - EPSILON <= b.x &&
    b.x <= Math.max(a.x, c.x) + EPSILON &&
    Math.min(a.y, c.y) - EPSILON <= b.y &&
    b.y <= Math.max(a.y, c.y) + EPSILON
  );
}

function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }

  if (Math.abs(o1) < EPSILON && onSegment(a1, b1, a2)) {
    return true;
  }
  if (Math.abs(o2) < EPSILON && onSegment(a1, b2, a2)) {
    return true;
  }
  if (Math.abs(o3) < EPSILON && onSegment(b1, a1, b2)) {
    return true;
  }
  if (Math.abs(o4) < EPSILON && onSegment(b1, a2, b2)) {
    return true;
  }

  return false;
}

export function internalAngles(vertices: Vec2[]): number[] {
  const pts = ensureCounterClockwise(vertices);
  const angles: number[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const prev = wrappedVertex(pts, i - 1);
    const curr = wrappedVertex(pts, i);
    const next = wrappedVertex(pts, i + 1);

    const a = normalize(sub(prev, curr));
    const b = normalize(sub(next, curr));
    const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
    angles.push(Math.acos(cosine));
  }
  return angles;
}

export function minimumInternalAngle(vertices: Vec2[]): number {
  const angles = internalAngles(vertices);
  return angles.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
}

export function regularityMetric(vertices: Vec2[]): number {
  if (vertices.length < 3) {
    return Number.POSITIVE_INFINITY;
  }

  const lengths: number[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const a = wrappedVertex(vertices, i);
    const b = wrappedVertex(vertices, i + 1);
    lengths.push(distance(a, b));
  }

  const angles = internalAngles(vertices);
  const lenMean = mean(lengths);
  const angleMean = mean(angles);
  const lenStd = stddev(lengths, lenMean);
  const angleStd = stddev(angles, angleMean);

  const lenCv = lenMean < EPSILON ? Number.POSITIVE_INFINITY : lenStd / lenMean;
  const angleCv = angleMean < EPSILON ? Number.POSITIVE_INFINITY : angleStd / angleMean;
  return lenCv + angleCv;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, values.length - 1);
  return Math.sqrt(variance);
}

export interface IrregularPolygonResult {
  vertices: Vec2[];
  irregularity: number;
}

export interface IrregularRadialPolygonResult {
  vertices: Vec2[];
  irregularity: number;
  radial: number[];
}

export function generateIrregularRadialPolygon(
  sides: number,
  radius: number,
  jitter: number,
  rng: SeededRng,
  maxAttempts = 30,
): IrregularRadialPolygonResult {
  const clampedJitter = clamp(jitter, 0, 0.45);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const radial: number[] = [];
    for (let i = 0; i < sides; i += 1) {
      radial.push(1 + rng.nextRange(-clampedJitter, clampedJitter));
    }

    const vertices = ensureCounterClockwise(radialPolygonVertices(sides, radius, radial));
    if (!isConvex(vertices) || !isSimplePolygon(vertices)) {
      continue;
    }

    return {
      vertices,
      irregularity: radialDeviation(radial),
      radial,
    };
  }

  const fallbackRadial = new Array(sides).fill(1);
  const fallbackVertices = regularPolygonVertices(sides, radius);
  return {
    vertices: fallbackVertices,
    irregularity: radialDeviation(fallbackRadial),
    radial: fallbackRadial,
  };
}

export function generateIrregularConvexPolygon(
  sides: number,
  radius: number,
  jitter: number,
  rng: SeededRng,
  maxAttempts = 30,
): IrregularPolygonResult {
  const clampedJitter = clamp(jitter, 0, 0.45);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const step = (Math.PI * 2) / sides;
    const points: Vec2[] = [];

    for (let i = 0; i < sides; i += 1) {
      const angleJitter = rng.nextRange(-step * 0.2, step * 0.2);
      const angle = i * step + angleJitter;
      const radial = radius * (1 + rng.nextRange(-clampedJitter, clampedJitter));
      points.push(vec(Math.cos(angle) * radial, Math.sin(angle) * radial));
    }

    // Sort by angle around origin so edges do not jump across the polygon.
    points.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

    const ccw = ensureCounterClockwise(points);
    if (isConvex(ccw) && isSimplePolygon(ccw)) {
      return {
        vertices: ccw,
        irregularity: regularityMetric(ccw),
      };
    }
  }

  const fallback = regularPolygonVertices(sides, radius);
  return {
    vertices: fallback,
    irregularity: regularityMetric(fallback),
  };
}

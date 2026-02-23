import { EPSILON, clamp, distance, dot, normalize, sub, vec } from './vector';
import type { Vec2 } from './vector';

export interface CircleGeometry {
  kind: 'circle';
  center: Vec2;
  radius: number;
}

export interface SegmentGeometry {
  kind: 'segment';
  a: Vec2;
  b: Vec2;
}

export interface PolygonGeometry {
  kind: 'polygon';
  vertices: Vec2[];
}

export type GeometryShape = CircleGeometry | SegmentGeometry | PolygonGeometry;

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function polygonVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Polygon vertex lookup failed.');
  }
  return vertex;
}

export function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function closestPointOnSegment(point: Vec2, segment: SegmentGeometry): Vec2 {
  const ab = sub(segment.b, segment.a);
  const ap = sub(point, segment.a);
  const denominator = dot(ab, ab);
  if (denominator <= EPSILON) {
    return segment.a;
  }
  const t = clamp(dot(ap, ab) / denominator, 0, 1);
  return vec(segment.a.x + ab.x * t, segment.a.y + ab.y * t);
}

function distanceSegmentToSegment(a: SegmentGeometry, b: SegmentGeometry): number {
  if (segmentSegmentIntersect(a, b)) {
    return 0;
  }

  const candidates = [
    distance(a.a, closestPointOnSegment(a.a, b)),
    distance(a.b, closestPointOnSegment(a.b, b)),
    distance(b.a, closestPointOnSegment(b.a, a)),
    distance(b.b, closestPointOnSegment(b.b, a)),
  ];

  return candidates.reduce((best, value) => Math.min(best, value), Number.POSITIVE_INFINITY);
}

export function aabbFromGeometry(shape: GeometryShape, segmentRadius = 0): Aabb {
  const lineRadius = Math.max(0, segmentRadius);
  switch (shape.kind) {
    case 'circle':
      return {
        minX: shape.center.x - shape.radius,
        minY: shape.center.y - shape.radius,
        maxX: shape.center.x + shape.radius,
        maxY: shape.center.y + shape.radius,
      };
    case 'segment':
      return {
        minX: Math.min(shape.a.x, shape.b.x) - lineRadius,
        minY: Math.min(shape.a.y, shape.b.y) - lineRadius,
        maxX: Math.max(shape.a.x, shape.b.x) + lineRadius,
        maxY: Math.max(shape.a.y, shape.b.y) + lineRadius,
      };
    case 'polygon': {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const p of shape.vertices) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, minY, maxX, maxY };
    }
  }
}

export function circleCircleIntersect(a: CircleGeometry, b: CircleGeometry): boolean {
  return distance(a.center, b.center) <= a.radius + b.radius + EPSILON;
}

export function distancePointToSegment(point: Vec2, segment: SegmentGeometry): number {
  const ab = sub(segment.b, segment.a);
  const ap = sub(point, segment.a);
  const denominator = dot(ab, ab);
  if (denominator <= EPSILON) {
    return distance(point, segment.a);
  }
  const t = clamp(dot(ap, ab) / denominator, 0, 1);
  const closest = vec(segment.a.x + ab.x * t, segment.a.y + ab.y * t);
  return distance(point, closest);
}

export function segmentCircleIntersect(
  segment: SegmentGeometry,
  circle: CircleGeometry,
  lineRadius = 0,
): boolean {
  const radius = Math.max(0, lineRadius);
  return distancePointToSegment(circle.center, segment) <= circle.radius + radius + EPSILON;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Vec2, b: Vec2, c: Vec2): boolean {
  return (
    Math.min(a.x, c.x) - EPSILON <= b.x &&
    b.x <= Math.max(a.x, c.x) + EPSILON &&
    Math.min(a.y, c.y) - EPSILON <= b.y &&
    b.y <= Math.max(a.y, c.y) + EPSILON
  );
}

export function segmentSegmentIntersect(a: SegmentGeometry, b: SegmentGeometry): boolean {
  const o1 = orientation(a.a, a.b, b.a);
  const o2 = orientation(a.a, a.b, b.b);
  const o3 = orientation(b.a, b.b, a.a);
  const o4 = orientation(b.a, b.b, a.b);

  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }

  if (Math.abs(o1) < EPSILON && onSegment(a.a, b.a, a.b)) {
    return true;
  }
  if (Math.abs(o2) < EPSILON && onSegment(a.a, b.b, a.b)) {
    return true;
  }
  if (Math.abs(o3) < EPSILON && onSegment(b.a, a.a, b.b)) {
    return true;
  }
  if (Math.abs(o4) < EPSILON && onSegment(b.a, a.b, b.b)) {
    return true;
  }

  return false;
}

export function pointInCircle(point: Vec2, circle: CircleGeometry): boolean {
  return distance(point, circle.center) <= circle.radius + EPSILON;
}

export function pointOnSegment(point: Vec2, segment: SegmentGeometry, tolerance = 1): boolean {
  return distancePointToSegment(point, segment) <= tolerance;
}

function projectPolygonOntoAxis(vertices: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    const projection = dot(vertex, axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function overlap1d(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min <= b.max + EPSILON && b.min <= a.max + EPSILON;
}

function polygonAxes(vertices: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const current = polygonVertex(vertices, i);
    const next = polygonVertex(vertices, i + 1);
    const edge = sub(next, current);
    const normal = normalize(vec(-edge.y, edge.x));
    axes.push(normal);
  }
  return axes;
}

export function polygonPolygonIntersectSAT(a: PolygonGeometry, b: PolygonGeometry): boolean {
  const axes = [...polygonAxes(a.vertices), ...polygonAxes(b.vertices)];
  for (const axis of axes) {
    const projectionA = projectPolygonOntoAxis(a.vertices, axis);
    const projectionB = projectPolygonOntoAxis(b.vertices, axis);
    if (!overlap1d(projectionA, projectionB)) {
      return false;
    }
  }
  return true;
}

export function pointInConvexPolygon(point: Vec2, polygon: PolygonGeometry): boolean {
  const { vertices } = polygon;
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
    if (currentSign !== sign) {
      return false;
    }
  }
  return true;
}

export function segmentPolygonIntersect(
  segment: SegmentGeometry,
  polygon: PolygonGeometry,
  lineRadius = 0,
): boolean {
  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const edge: SegmentGeometry = {
      kind: 'segment',
      a: polygonVertex(polygon.vertices, i),
      b: polygonVertex(polygon.vertices, i + 1),
    };
    if (segmentSegmentIntersect(segment, edge)) {
      return true;
    }
  }

  const endpointInside = pointInConvexPolygon(segment.a, polygon) || pointInConvexPolygon(segment.b, polygon);
  if (endpointInside) {
    return true;
  }

  const radius = Math.max(0, lineRadius);
  if (radius <= 0) {
    return false;
  }

  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const edge: SegmentGeometry = {
      kind: 'segment',
      a: polygonVertex(polygon.vertices, i),
      b: polygonVertex(polygon.vertices, i + 1),
    };
    if (distanceSegmentToSegment(segment, edge) <= radius + EPSILON) {
      return true;
    }
  }

  return false;
}

export function circlePolygonIntersect(circle: CircleGeometry, polygon: PolygonGeometry): boolean {
  if (pointInConvexPolygon(circle.center, polygon)) {
    return true;
  }

  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const edge: SegmentGeometry = {
      kind: 'segment',
      a: polygonVertex(polygon.vertices, i),
      b: polygonVertex(polygon.vertices, i + 1),
    };
    if (segmentCircleIntersect(edge, circle)) {
      return true;
    }
  }

  return false;
}

export function geometriesIntersect(a: GeometryShape, b: GeometryShape, lineRadius = 0): boolean {
  const segmentRadius = Math.max(0, lineRadius);
  if (a.kind === 'circle' && b.kind === 'circle') {
    return circleCircleIntersect(a, b);
  }

  if (a.kind === 'polygon' && b.kind === 'polygon') {
    return polygonPolygonIntersectSAT(a, b);
  }

  if (a.kind === 'segment' && b.kind === 'circle') {
    return segmentCircleIntersect(a, b, segmentRadius);
  }

  if (a.kind === 'circle' && b.kind === 'segment') {
    return segmentCircleIntersect(b, a, segmentRadius);
  }

  if (a.kind === 'segment' && b.kind === 'polygon') {
    return segmentPolygonIntersect(a, b, segmentRadius);
  }

  if (a.kind === 'polygon' && b.kind === 'segment') {
    return segmentPolygonIntersect(b, a, segmentRadius);
  }

  if (a.kind === 'circle' && b.kind === 'polygon') {
    return circlePolygonIntersect(a, b);
  }

  if (a.kind === 'polygon' && b.kind === 'circle') {
    return circlePolygonIntersect(b, a);
  }

  if (a.kind === 'segment' && b.kind === 'segment') {
    if (segmentSegmentIntersect(a, b)) {
      return true;
    }
    return distanceSegmentToSegment(a, b) <= segmentRadius * 2 + EPSILON;
  }

  return false;
}

export function shapeContainsPoint(shape: GeometryShape, point: Vec2): boolean {
  switch (shape.kind) {
    case 'circle':
      return pointInCircle(point, shape);
    case 'polygon':
      return pointInConvexPolygon(point, shape);
    case 'segment':
      return pointOnSegment(point, shape, 1.5);
  }
}

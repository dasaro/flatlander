import {
  distancePointToSegment,
  pointInConvexPolygon,
  segmentSegmentIntersect,
  type CircleGeometry,
  type GeometryShape,
  type PolygonGeometry,
  type SegmentGeometry,
} from './intersections';
import { EPSILON, add, distance, dot, length, mul, normalize, sub, vec } from './vector';
import type { Vec2 } from './vector';

export interface CollisionManifold {
  normal: Vec2;
  penetration: number;
  contactPoint: Vec2;
  featureA?: SupportFeature;
  featureB?: SupportFeature;
  closingSpeed?: number;
}

export type SupportFeatureKind = 'vertex' | 'edge' | 'endpoint' | 'circle';

export interface SupportFeature {
  kind: SupportFeatureKind;
  index?: number;
}

interface SegmentDistanceResult {
  distance: number;
  pointOnA: Vec2;
  pointOnB: Vec2;
}

interface PolygonBoundaryPoint {
  point: Vec2;
  distance: number;
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function centroidOfGeometry(shape: GeometryShape): Vec2 {
  if (shape.kind === 'circle') {
    return shape.center;
  }

  if (shape.kind === 'segment') {
    return midpoint(shape.a, shape.b);
  }

  let sx = 0;
  let sy = 0;
  for (const vertex of shape.vertices) {
    sx += vertex.x;
    sy += vertex.y;
  }

  return {
    x: sx / Math.max(1, shape.vertices.length),
    y: sy / Math.max(1, shape.vertices.length),
  };
}

function normalizedOrFallback(candidate: Vec2, fallback: Vec2): Vec2 {
  const n = normalize(candidate);
  if (length(n) > EPSILON) {
    return n;
  }
  const f = normalize(fallback);
  if (length(f) > EPSILON) {
    return f;
  }
  return vec(1, 0);
}

function orientedSegmentPerpendicular(segment: SegmentGeometry, toward: Vec2): Vec2 {
  const direction = sub(segment.b, segment.a);
  const perpendicular = normalize(vec(-direction.y, direction.x));
  if (length(perpendicular) <= EPSILON) {
    return vec(1, 0);
  }

  return dot(perpendicular, toward) >= 0 ? perpendicular : mul(perpendicular, -1);
}

function fallbackNormal(
  aShape: GeometryShape,
  bShape: GeometryShape,
  aId: number,
  bId: number,
): Vec2 {
  const centroidA = centroidOfGeometry(aShape);
  const centroidB = centroidOfGeometry(bShape);
  const between = sub(centroidB, centroidA);
  if (length(between) > EPSILON) {
    return normalize(between);
  }

  if (aShape.kind === 'segment') {
    return orientedSegmentPerpendicular(aShape, between);
  }

  if (bShape.kind === 'segment') {
    const bPerp = orientedSegmentPerpendicular(bShape, mul(between, -1));
    return mul(bPerp, -1);
  }

  return aId <= bId ? vec(1, 0) : vec(-1, 0);
}

function closestPointOnSegment(point: Vec2, segment: SegmentGeometry): Vec2 {
  const ab = sub(segment.b, segment.a);
  const denominator = dot(ab, ab);
  if (denominator <= EPSILON) {
    return segment.a;
  }

  const ap = sub(point, segment.a);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / denominator));
  return {
    x: segment.a.x + ab.x * t,
    y: segment.a.y + ab.y * t,
  };
}

function edgeAt(vertices: Vec2[], index: number): SegmentGeometry {
  const wrappedA = ((index % vertices.length) + vertices.length) % vertices.length;
  const wrappedB = ((index + 1) % vertices.length + vertices.length) % vertices.length;
  const a = vertices[wrappedA];
  const b = vertices[wrappedB];
  if (!a || !b) {
    throw new Error('Invalid polygon edge while computing manifold.');
  }
  return {
    kind: 'segment',
    a,
    b,
  };
}

function closestPointsBetweenSegments(a: SegmentGeometry, b: SegmentGeometry): SegmentDistanceResult {
  if (segmentSegmentIntersect(a, b)) {
    const contact = midpoint(midpoint(a.a, a.b), midpoint(b.a, b.b));
    return {
      distance: 0,
      pointOnA: contact,
      pointOnB: contact,
    };
  }

  const aToBAtA = closestPointOnSegment(a.a, b);
  const aToBAtB = closestPointOnSegment(a.b, b);
  const bToAAtA = closestPointOnSegment(b.a, a);
  const bToAAtB = closestPointOnSegment(b.b, a);

  const candidates: SegmentDistanceResult[] = [
    {
      distance: distance(a.a, aToBAtA),
      pointOnA: a.a,
      pointOnB: aToBAtA,
    },
    {
      distance: distance(a.b, aToBAtB),
      pointOnA: a.b,
      pointOnB: aToBAtB,
    },
    {
      distance: distance(b.a, bToAAtA),
      pointOnA: bToAAtA,
      pointOnB: b.a,
    },
    {
      distance: distance(b.b, bToAAtB),
      pointOnA: bToAAtB,
      pointOnB: b.b,
    },
  ];

  let best = candidates[0];
  for (const candidate of candidates) {
    if (!best || candidate.distance < best.distance) {
      best = candidate;
    }
  }

  if (!best) {
    return {
      distance: 0,
      pointOnA: midpoint(a.a, a.b),
      pointOnB: midpoint(b.a, b.b),
    };
  }

  return best;
}

function closestPointOnPolygonBoundary(point: Vec2, polygon: PolygonGeometry): PolygonBoundaryPoint {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPoint = polygon.vertices[0] ?? vec(0, 0);

  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const edge = edgeAt(polygon.vertices, i);
    const closest = closestPointOnSegment(point, edge);
    const d = distance(point, closest);
    if (d < bestDistance) {
      bestDistance = d;
      bestPoint = closest;
    }
  }

  return {
    point: bestPoint,
    distance: bestDistance,
  };
}

function segmentPolygonDistance(
  segment: SegmentGeometry,
  polygon: PolygonGeometry,
): {
  distance: number;
  pointOnSegment: Vec2;
  pointOnPolygon: Vec2;
  endpointInside: boolean;
} {
  const endpointAInside = pointInConvexPolygon(segment.a, polygon);
  const endpointBInside = pointInConvexPolygon(segment.b, polygon);
  if (endpointAInside || endpointBInside) {
    const insidePoint = endpointAInside ? segment.a : segment.b;
    return {
      distance: 0,
      pointOnSegment: insidePoint,
      pointOnPolygon: insidePoint,
      endpointInside: true,
    };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSegmentPoint = segment.a;
  let bestPolygonPoint = segment.a;

  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const edge = edgeAt(polygon.vertices, i);
    const closest = closestPointsBetweenSegments(segment, edge);
    if (closest.distance < bestDistance) {
      bestDistance = closest.distance;
      bestSegmentPoint = closest.pointOnA;
      bestPolygonPoint = closest.pointOnB;
    }
  }

  return {
    distance: bestDistance,
    pointOnSegment: bestSegmentPoint,
    pointOnPolygon: bestPolygonPoint,
    endpointInside: false,
  };
}

function projectVertices(vertices: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    const projection = dot(vertex, axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function polygonAxes(vertices: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const edge = edgeAt(vertices, i);
    const direction = sub(edge.b, edge.a);
    axes.push(normalize(vec(-direction.y, direction.x)));
  }
  return axes;
}

function polygonPolygonManifold(
  a: PolygonGeometry,
  b: PolygonGeometry,
  aId: number,
  bId: number,
): CollisionManifold | null {
  let bestOverlap = Number.POSITIVE_INFINITY;
  let bestAxis = vec(1, 0);
  const axes = [...polygonAxes(a.vertices), ...polygonAxes(b.vertices)];

  for (const axisRaw of axes) {
    const axis = normalize(axisRaw);
    if (length(axis) <= EPSILON) {
      continue;
    }

    const projectionA = projectVertices(a.vertices, axis);
    const projectionB = projectVertices(b.vertices, axis);
    const overlap =
      Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min);
    if (overlap < -EPSILON) {
      return null;
    }

    const overlapClamped = Math.max(0, overlap);
    if (overlapClamped < bestOverlap) {
      bestOverlap = overlapClamped;
      bestAxis = axis;
    }
  }

  const centroidA = centroidOfGeometry(a);
  const centroidB = centroidOfGeometry(b);
  let normal = bestAxis;
  if (dot(normal, sub(centroidB, centroidA)) < 0) {
    normal = mul(normal, -1);
  }
  normal = normalizedOrFallback(normal, fallbackNormal(a, b, aId, bId));

  return {
    normal,
    penetration: Math.max(0, bestOverlap),
    contactPoint: midpoint(centroidA, centroidB),
  };
}

function circleCircleManifold(
  a: CircleGeometry,
  b: CircleGeometry,
  aId: number,
  bId: number,
): CollisionManifold | null {
  const between = sub(b.center, a.center);
  const dist = length(between);
  const allowed = a.radius + b.radius;
  if (dist > allowed + EPSILON) {
    return null;
  }

  const normal = normalizedOrFallback(between, fallbackNormal(a, b, aId, bId));
  const penetration = Math.max(0, allowed - dist);
  const contactPoint = add(a.center, mul(normal, a.radius - penetration * 0.5));

  return {
    normal,
    penetration,
    contactPoint,
  };
}

function segmentCircleManifold(
  segment: SegmentGeometry,
  circle: CircleGeometry,
  lineRadius: number,
  segmentId: number,
  circleId: number,
): CollisionManifold | null {
  const closest = closestPointOnSegment(circle.center, segment);
  const between = sub(circle.center, closest);
  const dist = length(between);
  const allowed = circle.radius + Math.max(0, lineRadius);
  if (dist > allowed + EPSILON) {
    return null;
  }

  const fallback = fallbackNormal(segment, circle, segmentId, circleId);
  const normal = normalizedOrFallback(between, fallback);
  const penetration = Math.max(0, allowed - dist);
  const circleBoundary = sub(circle.center, mul(normal, circle.radius));

  return {
    normal,
    penetration,
    contactPoint: midpoint(closest, circleBoundary),
  };
}

function segmentSegmentManifold(
  a: SegmentGeometry,
  b: SegmentGeometry,
  lineRadius: number,
  aId: number,
  bId: number,
): CollisionManifold | null {
  const radius = Math.max(0, lineRadius);
  const allowed = radius * 2;
  const closest = closestPointsBetweenSegments(a, b);
  if (closest.distance > allowed + EPSILON) {
    return null;
  }

  const normal = normalizedOrFallback(
    sub(closest.pointOnB, closest.pointOnA),
    fallbackNormal(a, b, aId, bId),
  );
  return {
    normal,
    penetration: Math.max(0, allowed - closest.distance),
    contactPoint: midpoint(closest.pointOnA, closest.pointOnB),
  };
}

function segmentPolygonManifold(
  segment: SegmentGeometry,
  polygon: PolygonGeometry,
  lineRadius: number,
  segmentId: number,
  polygonId: number,
): CollisionManifold | null {
  const radius = Math.max(0, lineRadius);
  const distanceResult = segmentPolygonDistance(segment, polygon);
  const collides = distanceResult.endpointInside || distanceResult.distance <= radius + EPSILON;
  if (!collides) {
    return null;
  }

  const segmentCentroid = centroidOfGeometry(segment);
  const polygonCentroid = centroidOfGeometry(polygon);

  if (distanceResult.endpointInside) {
    const insideDepth = closestPointOnPolygonBoundary(segmentCentroid, polygon).distance;
    return {
      normal: normalizedOrFallback(
        sub(polygonCentroid, segmentCentroid),
        fallbackNormal(segment, polygon, segmentId, polygonId),
      ),
      penetration: radius + Math.max(0, insideDepth),
      contactPoint: distanceResult.pointOnSegment,
    };
  }

  return {
    normal: normalizedOrFallback(
      sub(distanceResult.pointOnPolygon, distanceResult.pointOnSegment),
      fallbackNormal(segment, polygon, segmentId, polygonId),
    ),
    penetration: Math.max(0, radius - distanceResult.distance),
    contactPoint: midpoint(distanceResult.pointOnSegment, distanceResult.pointOnPolygon),
  };
}

function circlePolygonManifold(
  circle: CircleGeometry,
  polygon: PolygonGeometry,
  circleId: number,
  polygonId: number,
): CollisionManifold | null {
  const closest = closestPointOnPolygonBoundary(circle.center, polygon);
  const inside = pointInConvexPolygon(circle.center, polygon);

  if (!inside && closest.distance > circle.radius + EPSILON) {
    return null;
  }

  if (inside) {
    return {
      normal: normalizedOrFallback(
        sub(centroidOfGeometry(polygon), circle.center),
        fallbackNormal(circle, polygon, circleId, polygonId),
      ),
      penetration: Math.max(0, circle.radius + closest.distance),
      contactPoint: closest.point,
    };
  }

  const normal = normalizedOrFallback(
    sub(closest.point, circle.center),
    fallbackNormal(circle, polygon, circleId, polygonId),
  );
  const circleBoundary = add(circle.center, mul(normal, circle.radius));
  return {
    normal,
    penetration: Math.max(0, circle.radius - closest.distance),
    contactPoint: midpoint(closest.point, circleBoundary),
  };
}

function invertManifold(manifold: CollisionManifold): CollisionManifold {
  return {
    normal: mul(manifold.normal, -1),
    penetration: manifold.penetration,
    contactPoint: manifold.contactPoint,
  };
}

export function computeCollisionManifold(
  aShape: GeometryShape,
  bShape: GeometryShape,
  lineRadius: number,
  aId: number,
  bId: number,
): CollisionManifold | null {
  if (aShape.kind === 'circle' && bShape.kind === 'circle') {
    return circleCircleManifold(aShape, bShape, aId, bId);
  }

  if (aShape.kind === 'polygon' && bShape.kind === 'polygon') {
    return polygonPolygonManifold(aShape, bShape, aId, bId);
  }

  if (aShape.kind === 'segment' && bShape.kind === 'circle') {
    return segmentCircleManifold(aShape, bShape, lineRadius, aId, bId);
  }

  if (aShape.kind === 'circle' && bShape.kind === 'segment') {
    const swapped = segmentCircleManifold(bShape, aShape, lineRadius, bId, aId);
    return swapped ? invertManifold(swapped) : null;
  }

  if (aShape.kind === 'segment' && bShape.kind === 'segment') {
    return segmentSegmentManifold(aShape, bShape, lineRadius, aId, bId);
  }

  if (aShape.kind === 'segment' && bShape.kind === 'polygon') {
    return segmentPolygonManifold(aShape, bShape, lineRadius, aId, bId);
  }

  if (aShape.kind === 'polygon' && bShape.kind === 'segment') {
    const swapped = segmentPolygonManifold(bShape, aShape, lineRadius, bId, aId);
    return swapped ? invertManifold(swapped) : null;
  }

  if (aShape.kind === 'circle' && bShape.kind === 'polygon') {
    return circlePolygonManifold(aShape, bShape, aId, bId);
  }

  if (aShape.kind === 'polygon' && bShape.kind === 'circle') {
    const swapped = circlePolygonManifold(bShape, aShape, bId, aId);
    return swapped ? invertManifold(swapped) : null;
  }

  return null;
}

export function shapeCenter(shape: GeometryShape): Vec2 {
  return centroidOfGeometry(shape);
}

export function distancePointToCircleBoundary(point: Vec2, circle: CircleGeometry): number {
  return Math.abs(distance(point, circle.center) - circle.radius);
}

export function distancePointToPolygonBoundary(point: Vec2, polygon: PolygonGeometry): number {
  return closestPointOnPolygonBoundary(point, polygon).distance;
}

export function distancePointToSegmentBoundary(point: Vec2, segment: SegmentGeometry): number {
  return distancePointToSegment(point, segment);
}

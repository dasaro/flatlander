import {
  distancePointToSegment,
  pointInCircle,
  pointInConvexPolygon,
  pointOnSegment,
  type CircleGeometry,
  type GeometryShape,
  type PolygonGeometry,
} from './intersections';
import { distancePointToConvexPolygonEdges } from './picking';
import { clamp, distance, normalize, sub } from './vector';
import type { Vec2 } from './vector';

export interface ContactClassification {
  type: 'touch' | 'vertexContact';
  aHasVertexContact: boolean;
  bHasVertexContact: boolean;
  aVertexAngleRad?: number;
  bVertexAngleRad?: number;
}

function wrappedVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Contact vertex lookup failed.');
  }
  return vertex;
}

function polygonVertexAngle(vertices: Vec2[], index: number): number {
  const prev = wrappedVertex(vertices, index - 1);
  const curr = wrappedVertex(vertices, index);
  const next = wrappedVertex(vertices, index + 1);
  const a = normalize(sub(prev, curr));
  const b = normalize(sub(next, curr));
  const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return Math.acos(cosine);
}

function distancePointToCircleBoundary(point: Vec2, circle: CircleGeometry): number {
  return Math.abs(distance(point, circle.center) - circle.radius);
}

function distancePointToPolygonBoundary(point: Vec2, polygon: PolygonGeometry): number {
  return distancePointToConvexPolygonEdges(point, polygon.vertices);
}

function distancePointToShapeBoundary(point: Vec2, shape: GeometryShape): number {
  if (shape.kind === 'circle') {
    return distancePointToCircleBoundary(point, shape);
  }

  if (shape.kind === 'segment') {
    return distancePointToSegment(point, shape);
  }

  return distancePointToPolygonBoundary(point, shape);
}

function pointInsideShape(point: Vec2, shape: GeometryShape, epsilon: number): boolean {
  if (shape.kind === 'circle') {
    return pointInCircle(point, shape);
  }

  if (shape.kind === 'segment') {
    return pointOnSegment(point, shape, epsilon);
  }

  return pointInConvexPolygon(point, shape);
}

function attackerVertices(shape: GeometryShape): Array<{ point: Vec2; angleRad: number }> {
  if (shape.kind === 'circle') {
    return [];
  }

  if (shape.kind === 'segment') {
    return [
      { point: shape.a, angleRad: 0 },
      { point: shape.b, angleRad: 0 },
    ];
  }

  return shape.vertices.map((point, index) => ({
    point,
    angleRad: polygonVertexAngle(shape.vertices, index),
  }));
}

function vertexContactTowards(
  attacker: GeometryShape,
  defender: GeometryShape,
  epsilon: number,
): { hasVertexContact: boolean; minAngleRad?: number } {
  const candidates = attackerVertices(attacker);
  let minAngle = Number.POSITIVE_INFINITY;
  let found = false;

  for (const candidate of candidates) {
    const inside = pointInsideShape(candidate.point, defender, epsilon);
    const boundaryDistance = distancePointToShapeBoundary(candidate.point, defender);
    if (inside || boundaryDistance <= epsilon) {
      found = true;
      minAngle = Math.min(minAngle, candidate.angleRad);
    }
  }

  if (!found) {
    return { hasVertexContact: false };
  }

  return { hasVertexContact: true, minAngleRad: minAngle };
}

export function classifyContact(
  aShape: GeometryShape,
  bShape: GeometryShape,
  epsilon: number,
): ContactClassification {
  const a = vertexContactTowards(aShape, bShape, epsilon);
  const b = vertexContactTowards(bShape, aShape, epsilon);
  const hasVertexContact = a.hasVertexContact || b.hasVertexContact;

  return {
    type: hasVertexContact ? 'vertexContact' : 'touch',
    aHasVertexContact: a.hasVertexContact,
    bHasVertexContact: b.hasVertexContact,
    ...(a.minAngleRad !== undefined ? { aVertexAngleRad: a.minAngleRad } : {}),
    ...(b.minAngleRad !== undefined ? { bVertexAngleRad: b.minAngleRad } : {}),
  };
}

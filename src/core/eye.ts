import { geometryFromComponents } from './entityGeometry';
import type { World } from './world';
import { angleToVector, clamp, dot, normalize, sub } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

function wrappedVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Eye vertex lookup failed.');
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

function isoscelesEyeFromTriangle(vertices: Vec2[]): Vec2 {
  let apexIndex = 0;
  let minAngle = Number.POSITIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 1) {
    const angle = polygonVertexAngle(vertices, i);
    if (angle < minAngle) {
      minAngle = angle;
      apexIndex = i;
    }
  }

  const baseA = wrappedVertex(vertices, apexIndex + 1);
  const baseB = wrappedVertex(vertices, apexIndex + 2);
  return {
    x: (baseA.x + baseB.x) / 2,
    y: (baseA.y + baseB.y) / 2,
  };
}

export function getForwardUnitVector(rotation: number): Vec2 {
  return angleToVector(rotation);
}

export function getEyeWorldPosition(world: World, entityId: number): Vec2 | null {
  const shape = world.shapes.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!shape || !transform) {
    return null;
  }

  const forward = getForwardUnitVector(transform.rotation);
  const geometry = world.geometries.get(entityId) ?? geometryFromComponents(shape, transform);

  if (geometry.kind === 'circle') {
    return {
      x: geometry.center.x + forward.x * geometry.radius,
      y: geometry.center.y + forward.y * geometry.radius,
    };
  }

  if (geometry.kind === 'segment') {
    const aScore = dot(sub(geometry.a, transform.position), forward);
    const bScore = dot(sub(geometry.b, transform.position), forward);
    return aScore >= bScore ? geometry.a : geometry.b;
  }

  if (
    shape.kind === 'polygon' &&
    shape.sides === 3 &&
    shape.triangleKind === 'Isosceles' &&
    geometry.vertices.length === 3
  ) {
    return isoscelesEyeFromTriangle(geometry.vertices);
  }

  let best = geometry.vertices[0];
  if (!best) {
    return transform.position;
  }
  let bestScore = dot(sub(best, transform.position), forward);

  for (let i = 1; i < geometry.vertices.length; i += 1) {
    const vertex = geometry.vertices[i];
    if (!vertex) {
      continue;
    }

    const score = dot(sub(vertex, transform.position), forward);
    if (score > bestScore) {
      best = vertex;
      bestScore = score;
    }
  }

  return best;
}

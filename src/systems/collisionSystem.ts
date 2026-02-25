import { geometryFromComponents } from '../core/entityGeometry';
import { isEntityOutside, shouldCollideEntities } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { computeCollisionManifold, type SupportFeature } from '../geometry/collisionManifold';
import { aabbFromGeometry, aabbIntersects } from '../geometry/intersections';
import type { GeometryShape } from '../geometry/intersections';
import { angleToVector, dot, normalize, sub } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import { SpatialHashGrid } from '../geometry/spatialHash';
import type { System } from './system';

function entityVelocity(world: World, entityId: number): Vec2 {
  const movement = world.movements.get(entityId);
  const southVy = world.southDrifts.get(entityId)?.vy ?? 0;
  if (!movement) {
    return { x: 0, y: southVy };
  }

  if (movement.type === 'straightDrift') {
    return {
      x: movement.vx,
      y: movement.vy + southVy,
    };
  }

  const forward = angleToVector(movement.heading);
  return {
    x: forward.x * movement.speed,
    y: forward.y * movement.speed + southVy,
  };
}

function polygonSupportFeature(vertices: Vec2[], direction: Vec2, epsilon: number): SupportFeature {
  let maxDot = Number.NEGATIVE_INFINITY;
  const indices: number[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    if (!vertex) {
      continue;
    }
    const projection = dot(vertex, direction);
    if (projection > maxDot + epsilon) {
      maxDot = projection;
      indices.length = 0;
      indices.push(i);
      continue;
    }
    if (Math.abs(projection - maxDot) <= epsilon) {
      indices.push(i);
    }
  }

  if (indices.length === 1) {
    const index = indices[0];
    if (index === undefined) {
      return { kind: 'edge' };
    }

    return {
      kind: 'vertex',
      index,
    };
  }

  return { kind: 'edge' };
}

function nearestDistinctVertexIndex(vertices: Vec2[], point: Vec2, epsilon: number): number | null {
  let bestIndex = -1;
  let bestDistance2 = Number.POSITIVE_INFINITY;
  let secondBestDistance2 = Number.POSITIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    if (!vertex) {
      continue;
    }

    const dx = vertex.x - point.x;
    const dy = vertex.y - point.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistance2) {
      secondBestDistance2 = bestDistance2;
      bestDistance2 = d2;
      bestIndex = i;
      continue;
    }
    if (d2 < secondBestDistance2) {
      secondBestDistance2 = d2;
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  if (secondBestDistance2 <= bestDistance2 + epsilon * epsilon) {
    return null;
  }

  if (bestDistance2 > secondBestDistance2 * 0.35) {
    return null;
  }

  return bestIndex;
}

function supportFeatureForGeometry(
  geometry: GeometryShape,
  direction: Vec2,
  epsilon: number,
  contactPoint: Vec2,
): SupportFeature {
  if (geometry.kind === 'circle') {
    return { kind: 'circle' };
  }

  if (geometry.kind === 'segment') {
    const toA = (geometry.a.x - contactPoint.x) ** 2 + (geometry.a.y - contactPoint.y) ** 2;
    const toB = (geometry.b.x - contactPoint.x) ** 2 + (geometry.b.y - contactPoint.y) ** 2;
    if (toB + epsilon * epsilon < toA) {
      return { kind: 'endpoint', index: 1 };
    }
    return { kind: 'endpoint', index: 0 };
  }

  const support = polygonSupportFeature(geometry.vertices, direction, epsilon);
  if (support.kind === 'edge' && geometry.vertices.length === 3) {
    const nearestIndex = nearestDistinctVertexIndex(geometry.vertices, contactPoint, epsilon * 2);
    if (nearestIndex !== null) {
      return {
        kind: 'vertex',
        index: nearestIndex,
      };
    }
  }

  return support;
}

export function rebuildCollisionState(world: World): void {
  const ids = getSortedEntityIds(world);
  const grid = new SpatialHashGrid(world.config.spatialHashCellSize);
  const lineRadius = Math.max(0, world.config.lineRadius);

  world.geometries.clear();

  const items: Array<{ id: number; aabb: ReturnType<typeof aabbFromGeometry> }> = [];
  for (const id of ids) {
    if (!isEntityOutside(world, id)) {
      continue;
    }

    const shape = world.shapes.get(id);
    const transform = world.transforms.get(id);
    if (!shape || !transform) {
      continue;
    }

    const geometry = geometryFromComponents(shape, transform);
    world.geometries.set(id, geometry);
    items.push({
      id,
      aabb: aabbFromGeometry(geometry, lineRadius),
    });
  }

  world.collisions = [];
  world.manifolds = [];
  const pairs = grid.computePairs(items);

  const itemAabb = new Map(items.map((item) => [item.id, item.aabb]));

  for (const [a, b] of pairs) {
    if (!shouldCollideEntities(world, a, b)) {
      continue;
    }

    const aShape = world.geometries.get(a);
    const bShape = world.geometries.get(b);
    const aAabb = itemAabb.get(a);
    const bAabb = itemAabb.get(b);

    if (!aShape || !bShape || !aAabb || !bAabb) {
      continue;
    }

    if (!aabbIntersects(aAabb, bAabb)) {
      continue;
    }

    const manifold = computeCollisionManifold(aShape, bShape, lineRadius, a, b);
    if (!manifold) {
      continue;
    }

    const shapeA = world.shapes.get(a);
    const shapeB = world.shapes.get(b);
    const scale = Math.max(1, shapeA?.boundingRadius ?? 1, shapeB?.boundingRadius ?? 1);
    const supportEpsilon = Math.max(1e-9, world.config.supportEpsilon * scale);
    const featureA = supportFeatureForGeometry(
      aShape,
      manifold.normal,
      supportEpsilon,
      manifold.contactPoint,
    );
    const featureB = supportFeatureForGeometry(
      bShape,
      {
        x: -manifold.normal.x,
        y: -manifold.normal.y,
      },
      supportEpsilon,
      manifold.contactPoint,
    );
    const velocityA = entityVelocity(world, a);
    const velocityB = entityVelocity(world, b);
    const centerDirection = normalize(
      sub(
        world.transforms.get(b)?.position ?? { x: 0, y: 0 },
        world.transforms.get(a)?.position ?? { x: 0, y: 0 },
      ),
    );
    const closingAxis =
      Math.abs(centerDirection.x) + Math.abs(centerDirection.y) > 0 ? centerDirection : manifold.normal;
    const closingSpeed = Math.max(
      0,
      dot(
        {
          x: velocityA.x - velocityB.x,
          y: velocityA.y - velocityB.y,
        },
        closingAxis,
      ),
    );

    world.collisions.push({ a, b });
    world.manifolds.push({
      aId: a,
      bId: b,
      normal: manifold.normal,
      penetration: manifold.penetration,
      contactPoint: manifold.contactPoint,
      featureA,
      featureB,
      closingSpeed,
    });
  }

  world.manifolds.sort((left, right) => {
    const leftMin = Math.min(left.aId, left.bId);
    const rightMin = Math.min(right.aId, right.bId);
    if (leftMin !== rightMin) {
      return leftMin - rightMin;
    }

    const leftMax = Math.max(left.aId, left.bId);
    const rightMax = Math.max(right.aId, right.bId);
    if (leftMax !== rightMax) {
      return leftMax - rightMax;
    }

    return left.aId - right.aId;
  });
}

export class CollisionSystem implements System {
  update(world: World, _dt?: number): void {
    void _dt;
    rebuildCollisionState(world);
  }
}

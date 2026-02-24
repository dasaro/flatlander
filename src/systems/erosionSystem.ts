import type { SupportFeature } from '../geometry/collisionManifold';
import type { GeometryShape } from '../geometry/intersections';
import { clamp, dot, normalize, sub } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import { rankKeyForEntity } from '../core/rankKey';
import { isEntityOutside } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function wrappedVertex(vertices: Array<{ x: number; y: number }>, index: number): { x: number; y: number } {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Missing polygon vertex while evaluating erosion.');
  }
  return vertex;
}

function vertexInternalAngle(vertices: Array<{ x: number; y: number }>, index: number): number {
  const prev = wrappedVertex(vertices, index - 1);
  const curr = wrappedVertex(vertices, index);
  const next = wrappedVertex(vertices, index + 1);
  const a = normalize(sub(prev, curr));
  const b = normalize(sub(next, curr));
  const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return Math.acos(cosine);
}

function sharpnessFromFeature(shape: GeometryShape, feature: SupportFeature): number {
  if (feature.kind === 'circle' || feature.kind === 'edge') {
    return 0;
  }

  if (feature.kind === 'endpoint') {
    return 1;
  }

  if (shape.kind !== 'polygon' || feature.index === undefined) {
    return 0;
  }

  const angle = vertexInternalAngle(shape.vertices, feature.index);
  return clamp((Math.PI - angle) / Math.PI, 0, 1);
}

function velocityForEntity(world: World, entityId: number): Vec2 {
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

  return {
    x: Math.cos(movement.heading) * movement.speed,
    y: Math.sin(movement.heading) * movement.speed + southVy,
  };
}

function applyWear(world: World, entityId: number, deltaWear: number): void {
  if (deltaWear <= 0 || world.staticObstacles.has(entityId) || !isEntityOutside(world, entityId)) {
    return;
  }

  const durability = world.durability.get(entityId);
  if (!durability) {
    return;
  }

  durability.wear += deltaWear;
  const wearStep = Math.max(0.01, world.config.wearToHpStep);
  if (durability.wear < wearStep) {
    return;
  }

  const hpLoss = Math.floor(durability.wear / wearStep);
  durability.wear -= hpLoss * wearStep;
  durability.hp -= hpLoss;
}

function applyDirectDamage(world: World, entityId: number, damage: number): void {
  if (damage <= 0 || world.staticObstacles.has(entityId) || !isEntityOutside(world, entityId)) {
    return;
  }

  const durability = world.durability.get(entityId);
  if (!durability) {
    return;
  }

  durability.hp -= damage;
}

function markDeath(world: World, entityId: number): void {
  if (world.pendingDeaths.has(entityId)) {
    return;
  }

  world.pendingDeaths.add(entityId);
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }

  world.events.push({
    type: 'death',
    tick: world.tick,
    entityId,
    pos: transform.position,
    rankKey: rankKeyForEntity(world, entityId),
  });
}

export class ErosionSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.wearEnabled || world.manifolds.length === 0) {
      return;
    }

    const sortedIds = getSortedEntityIds(world);
    const idSet = new Set(sortedIds);
    const wearRate = Math.max(0, world.config.wearRate);
    const stabScale = Math.max(0, world.config.stabHpDamageScale);
    const sharpnessExponent = Math.max(0.1, world.config.stabSharpnessExponent);

    for (const manifold of world.manifolds) {
      const { aId, bId, normal } = manifold;
      if (!idSet.has(aId) || !idSet.has(bId)) {
        continue;
      }
      if (!isEntityOutside(world, aId) || !isEntityOutside(world, bId)) {
        continue;
      }

      const aVelocity = velocityForEntity(world, aId);
      const bVelocity = velocityForEntity(world, bId);
      const relativeVelocity = {
        x: aVelocity.x - bVelocity.x,
        y: aVelocity.y - bVelocity.y,
      };
      const normalSpeed = dot(relativeVelocity, normal);
      const tangentVelocity = {
        x: relativeVelocity.x - normal.x * normalSpeed,
        y: relativeVelocity.y - normal.y * normalSpeed,
      };
      const tangentialSpeed = Math.hypot(tangentVelocity.x, tangentVelocity.y);
      const vertexContact =
        manifold.featureA.kind === 'vertex' ||
        manifold.featureA.kind === 'endpoint' ||
        manifold.featureB.kind === 'vertex' ||
        manifold.featureB.kind === 'endpoint';
      const contactFactor = vertexContact ? 1.25 : 0.65;
      const wearDelta = wearRate * tangentialSpeed * dt * contactFactor;
      applyWear(world, aId, wearDelta);
      applyWear(world, bId, wearDelta);

      const shapeA = world.geometries.get(aId);
      const shapeB = world.geometries.get(bId);
      if (!shapeA || !shapeB) {
        continue;
      }

      const sharpnessA = sharpnessFromFeature(shapeA, manifold.featureA);
      const sharpnessB = sharpnessFromFeature(shapeB, manifold.featureB);
      const severityA = sharpnessA ** sharpnessExponent * manifold.closingSpeed;
      const severityB = sharpnessB ** sharpnessExponent * manifold.closingSpeed;
      const damageA = stabScale * severityB * 0.11;
      const damageB = stabScale * severityA * 0.11;
      applyDirectDamage(world, aId, damageA);
      applyDirectDamage(world, bId, damageB);
    }

    for (const id of sortedIds) {
      const durability = world.durability.get(id);
      if (!durability || durability.hp > 0) {
        continue;
      }
      markDeath(world, id);
    }
  }
}

import type { MovementComponent, TransformComponent } from '../core/components';
import type { EntityId } from '../core/components';
import type { World } from '../core/world';
import { EPSILON, clamp, dot, length, mul, sub, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const COLLISION_VELOCITY_DEADBAND = 0.05;
const NORMAL_COMPONENT_EPS = 1e-4;

function removeIntoNormal(velocity: Vec2, normal: Vec2): Vec2 {
  const component = dot(velocity, normal);
  if (component <= NORMAL_COMPONENT_EPS) {
    return velocity;
  }
  return sub(velocity, mul(normal, component));
}

function movementVelocity(movement: MovementComponent): Vec2 {
  if (movement.type === 'straightDrift') {
    return {
      x: movement.vx,
      y: movement.vy,
    };
  }

  return {
    x: Math.cos(movement.heading) * movement.speed,
    y: Math.sin(movement.heading) * movement.speed,
  };
}

function applyVelocity(movement: MovementComponent, transform: TransformComponent, velocity: Vec2): void {
  const nextSpeed = length(velocity);
  if (nextSpeed <= COLLISION_VELOCITY_DEADBAND) {
    if (movement.type === 'straightDrift') {
      movement.vx = 0;
      movement.vy = 0;
      return;
    }

    movement.speed = 0;
    return;
  }

  if (movement.type === 'straightDrift') {
    movement.vx = velocity.x;
    movement.vy = velocity.y;
    transform.rotation = Math.atan2(velocity.y, velocity.x);
    return;
  }

  movement.speed = Math.max(0, nextSpeed);
  if (nextSpeed > EPSILON) {
    movement.heading = Math.atan2(velocity.y, velocity.x);
    transform.rotation = movement.heading;
  }
}

function correctWorldBounds(world: World, transform: TransformComponent): void {
  if (world.config.topology === 'bounded') {
    transform.position.x = clamp(transform.position.x, 0, world.config.width);
    transform.position.y = clamp(transform.position.y, 0, world.config.height);
    return;
  }

  transform.position.x = wrap(transform.position.x, world.config.width);
  transform.position.y = wrap(transform.position.y, world.config.height);
}

function resolveVelocityAgainstNormal(world: World, entityId: EntityId, normal: Vec2): void {
  if (world.staticObstacles.has(entityId) || world.pendingDeaths.has(entityId)) {
    return;
  }

  const movement = world.movements.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!movement || !transform) {
    return;
  }

  const corrected = removeIntoNormal(movementVelocity(movement), normal);
  applyVelocity(movement, transform, corrected);
}

function accumulateCorrection(world: World, entityId: EntityId, amount: number): void {
  const next = (world.lastCorrections.get(entityId) ?? 0) + Math.max(0, amount);
  world.lastCorrections.set(entityId, next);
}

function isActiveHandshakePair(world: World, aId: EntityId, bId: EntityId): boolean {
  const aFeeling = world.feeling.get(aId);
  const bFeeling = world.feeling.get(bId);
  if (!aFeeling || !bFeeling) {
    return false;
  }

  const aFeelsB = aFeeling.state === 'feeling' && aFeeling.partnerId === bId;
  const bBeingFeltByA = bFeeling.state === 'beingFelt' && bFeeling.partnerId === aId;
  const bFeelsA = bFeeling.state === 'feeling' && bFeeling.partnerId === aId;
  const aBeingFeltByB = aFeeling.state === 'beingFelt' && aFeeling.partnerId === bId;
  return (aFeelsB && bBeingFeltByA) || (bFeelsA && aBeingFeltByB);
}

function isHandshakeImmovable(world: World, entityId: EntityId): boolean {
  const stillness = world.stillness.get(entityId);
  if (!stillness) {
    return false;
  }

  return stillness.mode === 'full' && stillness.reason === 'beingFelt';
}

export class CollisionResolutionSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    world.lastCorrections.clear();
    if (world.manifolds.length === 0) {
      return;
    }

    const iterations = Math.max(1, Math.round(world.config.collisionResolveIterations));
    const slop = Math.max(0, world.config.collisionSlop);
    const percent = clamp(world.config.collisionResolvePercent, 0, 1);

    for (let pass = 0; pass < iterations; pass += 1) {
      const manifolds = world.manifolds;

      if (manifolds.length === 0) {
        break;
      }

      for (const manifold of manifolds) {
        const { aId, bId } = manifold;
        if (world.pendingDeaths.has(aId) || world.pendingDeaths.has(bId)) {
          continue;
        }

        const aTransform = world.transforms.get(aId);
        const bTransform = world.transforms.get(bId);
        if (!aTransform || !bTransform) {
          continue;
        }

        const aStatic = world.staticObstacles.has(aId) || isHandshakeImmovable(world, aId);
        const bStatic = world.staticObstacles.has(bId) || isHandshakeImmovable(world, bId);
        if (aStatic && bStatic) {
          continue;
        }

        const handshakePair = isActiveHandshakePair(world, aId, bId);
        const localSlop = handshakePair
          ? slop + Math.max(0, world.config.vertexContactEpsilon) * 0.75
          : slop;
        const localPercent = handshakePair ? percent * 0.2 : percent;
        const penetration = Math.max(0, manifold.penetration);
        const correctionMagnitude = Math.max(0, penetration - localSlop) * localPercent;
        if (correctionMagnitude <= 0) {
          resolveVelocityAgainstNormal(world, aId, manifold.normal);
          resolveVelocityAgainstNormal(world, bId, mul(manifold.normal, -1));
          continue;
        }
        const correction = mul(manifold.normal, correctionMagnitude);

        if (!aStatic && !bStatic) {
          aTransform.position = sub(aTransform.position, mul(correction, 0.5));
          bTransform.position = {
            x: bTransform.position.x + correction.x * 0.5,
            y: bTransform.position.y + correction.y * 0.5,
          };
          accumulateCorrection(world, aId, correctionMagnitude * 0.5);
          accumulateCorrection(world, bId, correctionMagnitude * 0.5);
          correctWorldBounds(world, aTransform);
          correctWorldBounds(world, bTransform);
        } else if (!aStatic) {
          aTransform.position = sub(aTransform.position, correction);
          accumulateCorrection(world, aId, correctionMagnitude);
          correctWorldBounds(world, aTransform);
        } else if (!bStatic) {
          bTransform.position = {
            x: bTransform.position.x + correction.x,
            y: bTransform.position.y + correction.y,
          };
          accumulateCorrection(world, bId, correctionMagnitude);
          correctWorldBounds(world, bTransform);
        }

        resolveVelocityAgainstNormal(world, aId, manifold.normal);
        resolveVelocityAgainstNormal(world, bId, mul(manifold.normal, -1));
      }
    }
  }
}
